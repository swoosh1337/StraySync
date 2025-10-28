import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  userTier: 'free' | 'supporter'
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
    
    const { count } = await supabase
      .from('ai_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', windowStart.toISOString())
    
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
  
  // Calculate remaining
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
  })
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase
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
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetAt.toISOString(),
          },
        }
      )
    }

    // Parse request
    const { imageUrl, imageBase64 } = await req.json()

    if (!imageUrl && !imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Image URL or base64 required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare image for OpenAI
    const imageInput = imageBase64
      ? `data:image/jpeg;base64,${imageBase64}`
      : imageUrl

    // Call OpenAI Vision API (gpt-4o for image analysis)
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Vision model for analyzing images
        messages: [
          {
            role: 'system',
            content: 'You are an expert veterinarian and animal breed specialist. Analyze pet images accurately and return ONLY valid JSON.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this cat or dog image. Return ONLY a JSON object with this structure:
{
  "animalType": "cat" or "dog",
  "breed": "specific breed name (e.g., 'Domestic Shorthair', 'Labrador Retriever')",
  "confidence": 0.0-1.0,
  "color": "primary color",
  "age": "kitten/puppy, young, adult, or senior",
  "healthStatus": "healthy, injured, sick, or unknown",
  "description": "2-3 sentence friendly description for a sighting report",
  "features": ["distinctive feature 1", "distinctive feature 2"]
}

Be specific with breeds. Return ONLY the JSON, no other text.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageInput,
                  detail: 'low', // Cost optimization
                },
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    })

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text()
      console.error('OpenAI error:', error)
      await logUsage(supabaseClient, user.id, false, 0, 0)
      
      return new Response(
        JSON.stringify({ error: 'AI analysis failed', details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await openaiResponse.json()
    
    // Calculate cost
    const tokensUsed = result.usage?.total_tokens || 0
    const cost = (tokensUsed / 1000) * 0.01 // Approximate cost

    // Parse AI response
    let analysis
    try {
      const content = result.choices[0].message.content
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content)
    } catch (e) {
      console.error('Parse error:', e)
      analysis = {
        animalType: 'unknown',
        breed: 'Unknown',
        description: result.choices[0].message.content,
      }
    }

    // Log successful usage
    await logUsage(supabaseClient, user.id, true, tokensUsed, cost)

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
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': (rateLimitResult.remaining - 1).toString(),
        },
      }
    )
  } catch (error: any) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
