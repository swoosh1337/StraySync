import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Rate limit configuration
const RATE_LIMITS = {
  free: {
    perMinute: 2,
    perHour: 10,
    perDay: 30,
  },
  supporter: {
    perMinute: 5,
    perHour: 50,
    perDay: 200,
  },
  admin: {
    perMinute: 20,
    perHour: 500,
    perDay: 2000,
  }
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  tier: string
}

async function checkRateLimit(
  supabase: any,
  userId: string,
  userTier: 'free' | 'supporter' | 'admin'
): Promise<RateLimitResult> {
  const limits = RATE_LIMITS[userTier]
  const now = new Date()
  
  // Check multiple time windows
  const windows = [
    { duration: 60 * 1000, limit: limits.perMinute, name: 'minute' },
    { duration: 60 * 60 * 1000, limit: limits.perHour, name: 'hour' },
    { duration: 24 * 60 * 60 * 1000, limit: limits.perDay, name: 'day' },
  ]
  
  for (const window of windows) {
    const windowStart = new Date(now.getTime() - window.duration)
    
    // Count requests in this window with basic retry/backoff on transient errors
    let count: number | null = null
    let lastError: any = null
    const attempts = [0, 200, 500] // initial + backoffs (ms)
    for (let i = 0; i < attempts.length; i++) {
      if (attempts[i] > 0) {
        await new Promise((r) => setTimeout(r, attempts[i]))
      }
      const { count: c, error } = await supabase
        .from('ai_usage')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', windowStart.toISOString())
      if (!error) {
        count = c ?? 0
        lastError = null
        break
      }
      lastError = error
      console.error(`Rate limit check error (attempt ${i + 1}):`, error)
    }
    
    // If still failing after retries, fail closed to protect the system
    if (count === null && lastError) {
      const resetAt = new Date(now.getTime() + 60 * 1000) // advise retry in 60s
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        tier: userTier,
      }
    }
    
    // Check if limit exceeded
    if (count !== null && count >= window.limit) {
      const resetAt = new Date(windowStart.getTime() + window.duration)
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        tier: userTier,
      }
    }
  }
  
  // Calculate remaining (based on most restrictive window)
  const { count: dayCount } = await supabase
    .from('ai_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
  
  return {
    allowed: true,
    remaining: limits.perDay - (dayCount || 0),
    resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    tier: userTier,
  }
}

async function logUsage(
  supabase: any,
  userId: string,
  success: boolean,
  tokensUsed: number,
  cost: number
) {
  await supabase.from('ai_usage').insert({
    user_id: userId,
    success,
    tokens_used: tokensUsed,
    cost_usd: cost,
    created_at: new Date().toISOString(),
  })
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get user tier
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_supporter')
      .eq('id', user.id)
      .single()

    const userTier = profile?.is_supporter ? 'supporter' : 'free'

    // Check rate limit
    const rateLimitResult = await checkRateLimit(supabaseClient, user.id, userTier)

    if (!rateLimitResult.allowed) {
      const now = new Date()
      const retryAfterSeconds = Math.max(1, Math.ceil((rateLimitResult.resetAt.getTime() - now.getTime()) / 1000))
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `You've reached your ${rateLimitResult.tier} tier limit. Try again after ${rateLimitResult.resetAt.toLocaleTimeString()}.`,
          resetAt: rateLimitResult.resetAt.toISOString(),
          tier: rateLimitResult.tier,
          upgradeMessage: userTier === 'free' ? 'Upgrade to Supporter for higher limits!' : null,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': RATE_LIMITS[userTier].perDay.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetAt.toISOString(),
            'Retry-After': retryAfterSeconds.toString(),
          },
        }
      )
    }

    // Parse request
    const { image, prompt } = await req.json()

    if (!image) {
      return new Response(
        JSON.stringify({ error: 'Image URL required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Call OpenAI Vision API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Latest vision model
        messages: [
          {
            role: 'system',
            content: 'You are an expert veterinarian and animal breed specialist. Analyze images accurately and provide helpful, structured information.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt || `Analyze this cat or dog image. Provide a JSON response with:
{
  "animalType": "cat" or "dog",
  "breed": "specific breed name",
  "confidence": 0.0-1.0,
  "color": "primary color",
  "estimatedAge": "kitten/puppy, young, adult, or senior",
  "healthStatus": "healthy, injured, sick, or unknown",
  "description": "2-3 sentence description",
  "distinctiveFeatures": ["feature1", "feature2"]
}`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: image,
                  detail: 'low', // Use 'low' for cost efficiency
                },
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.3, // Lower for more consistent results
      }),
    })

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text()
      console.error('OpenAI API error:', error)
      
      // Log failed attempt
      await logUsage(supabaseClient, user.id, false, 0, 0)
      
      return new Response(
        JSON.stringify({ error: 'AI analysis failed', details: error }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const result = await openaiResponse.json()
    
    // Calculate cost (approximate)
    const tokensUsed = result.usage?.total_tokens || 0
    const costPer1kTokens = 0.01 // GPT-4o pricing
    const cost = (tokensUsed / 1000) * costPer1kTokens

    // Log successful usage
    await logUsage(supabaseClient, user.id, true, tokensUsed, cost)

    // Parse AI response
    let analysis
    try {
      const content = result.choices[0].message.content
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        analysis = { description: content }
      }
    } catch (e) {
      analysis = { description: result.choices[0].message.content }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        usage: {
          tokensUsed,
          cost,
          remaining: rateLimitResult.remaining - 1,
          tier: userTier,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': (rateLimitResult.remaining - 1).toString(),
        },
      }
    )
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
