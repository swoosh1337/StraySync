import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        console.log('=== MATCH LOST ANIMALS FUNCTION STARTED ===')

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role for full access
        )

        const { lostAnimalId, sightingId } = await req.json()
        console.log('Request params:', { lostAnimalId, sightingId })

        // If lostAnimalId provided, match against that specific lost animal
        // If sightingId provided, match that sighting against all active lost animals

        if (sightingId) {
            console.log('Matching sighting against lost animals...')
            // New sighting - check against all active lost animals
            await matchSightingWithLostAnimals(supabaseClient, sightingId)
        } else if (lostAnimalId) {
            console.log('Matching lost animal against sightings...')
            // New lost animal post - check against existing sightings
            await matchLostAnimalWithSightings(supabaseClient, lostAnimalId)
        } else {
            console.log('No lostAnimalId or sightingId provided')
        }

        console.log('=== MATCH FUNCTION COMPLETED SUCCESSFULLY ===')
        return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error: any) {
        console.error('=== MATCH FUNCTION ERROR ===')
        console.error('Match error:', error)
        console.error('Error stack:', error.stack)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

async function matchSightingWithLostAnimals(supabase: any, sightingId: string) {
    // Get the sighting details
    const { data: sighting, error: sightingError } = await supabase
        .from('animals')
        .select('*')
        .eq('id', sightingId)
        .single()

    if (sightingError || !sighting) {
        console.error('Sighting not found:', sightingError)
        return
    }

    // Get all active lost animals of the same type
    const { data: lostAnimals, error: lostError } = await supabase
        .from('lost_animals')
        .select('*')
        .eq('status', 'active')
        .eq('animal_type', sighting.animal_type)

    if (lostError || !lostAnimals || lostAnimals.length === 0) {
        console.log('No active lost animals to match')
        return
    }

    // Analyze each lost animal for potential match
    console.log(`Analyzing ${lostAnimals.length} lost animals for matches...`)

    for (const lostAnimal of lostAnimals) {
        console.log(`Comparing with lost animal: ${lostAnimal.name} (${lostAnimal.id})`)
        const matchResult = await analyzeMatch(supabase, lostAnimal, sighting)

        if (matchResult && matchResult.confidence >= 80) {
            console.log(`✅ MATCH FOUND! Confidence: ${matchResult.confidence}%`)
            console.log(`Reason: ${matchResult.reason}`)

            // Insert match record
            const { error: insertError } = await supabase
                .from('lost_animal_matches')
                .insert({
                    lost_animal_id: lostAnimal.id,
                    sighting_id: sighting.id,
                    confidence_score: matchResult.confidence,
                    match_reason: matchResult.reason,
                })

            if (insertError) {
                console.error('Error inserting match:', insertError)
            } else {
                console.log('Match record inserted successfully')
                // Send push notification to lost animal owner
                await sendMatchNotification(supabase, lostAnimal, sighting, matchResult.confidence)
            }
        } else {
            console.log(`No match (confidence: ${matchResult?.confidence || 0}%)`)
        }
    }
}

async function matchLostAnimalWithSightings(supabase: any, lostAnimalId: string) {
    // Get the lost animal details
    const { data: lostAnimal, error: lostError } = await supabase
        .from('lost_animals')
        .select('*')
        .eq('id', lostAnimalId)
        .single()

    if (lostError || !lostAnimal) {
        console.error('Lost animal not found:', lostError)
        return
    }

    // Extract coordinates from PostGIS geography type using SQL
    // Query with ST_X and ST_Y directly in the RPC call
    const { data: coordData, error: coordError } = await supabase
        .rpc('get_lost_animal_coordinates', { lost_animal_id: lostAnimalId })

    let lat: number, lng: number

    if (coordError || !coordData || coordData.length === 0) {
        console.error('Could not fetch location via RPC:', coordError)
        console.log('Trying alternative method...')

        // Fallback: Get all sightings without location filter
        // This ensures matching still works even if location parsing fails
        // Include rescued animals so owners can contact rescuers
        const { data: allSightings, error: allSightingsError } = await supabase
            .from('animals')
            .select('*')
            .eq('animal_type', lostAnimal.animal_type)
            .gte('spotted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .limit(50)

        if (allSightingsError || !allSightings || allSightings.length === 0) {
            console.log('No recent sightings found (fallback)')
            return
        }

        console.log(`Found ${allSightings.length} sightings (without location filter)`)

        // Analyze each sighting
        for (const sighting of allSightings) {
            console.log(`Comparing with sighting: ${sighting.id}`)
            const matchResult = await analyzeMatch(supabase, lostAnimal, sighting)

            if (matchResult && matchResult.confidence >= 80) {
                console.log(`✅ MATCH FOUND! Confidence: ${matchResult.confidence}%`)

                const { error: insertError } = await supabase
                    .from('lost_animal_matches')
                    .insert({
                        lost_animal_id: lostAnimal.id,
                        sighting_id: sighting.id,
                        confidence_score: matchResult.confidence,
                        match_reason: matchResult.reason,
                    })

                if (insertError) {
                    console.error('Error inserting match:', insertError)
                } else {
                    console.log('Match record inserted successfully')
                }
            } else {
                console.log(`No match (confidence: ${matchResult?.confidence || 0}%)`)
            }
        }
        return
    }

    lat = coordData[0].latitude
    lng = coordData[0].longitude

    console.log(`Location: lat=${lat}, lng=${lng}`)

    // Get recent sightings of the same type within reasonable distance (e.g., 50km)
    console.log(`Searching for ${lostAnimal.animal_type} sightings within 50km...`)

    const { data: sightings, error: sightingsError } = await supabase
        .rpc('get_nearby_animals', {
            lat: lat,
            lng: lng,
            radius_km: 50,
        })
        .eq('animal_type', lostAnimal.animal_type)
        .gte('spotted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days

    if (sightingsError) {
        console.error('Error fetching nearby animals:', sightingsError)
        console.log('Trying without location filter...')

        // Fallback: get all recent sightings without location filter
        const { data: allSightings, error: allError } = await supabase
            .from('animals')
            .select('*')
            .eq('animal_type', lostAnimal.animal_type)
            .gte('spotted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .limit(50)

        if (allError || !allSightings || allSightings.length === 0) {
            console.log('No recent sightings found at all')
            return
        }

        console.log(`Found ${allSightings.length} sightings (without location filter)`)

        // Use the fallback sightings
        for (const sighting of allSightings) {
            console.log(`Comparing with sighting: ${sighting.id}`)
            const matchResult = await analyzeMatch(supabase, lostAnimal, sighting)

            if (matchResult && matchResult.confidence >= 80) {
                console.log(`✅ MATCH FOUND! Confidence: ${matchResult.confidence}%`)

                const { error: insertError } = await supabase
                    .from('lost_animal_matches')
                    .insert({
                        lost_animal_id: lostAnimal.id,
                        sighting_id: sighting.id,
                        confidence_score: matchResult.confidence,
                        match_reason: matchResult.reason,
                    })

                if (!insertError) {
                    await sendMatchNotification(supabase, lostAnimal, sighting, matchResult.confidence)
                }
            } else {
                console.log(`No match (confidence: ${matchResult?.confidence || 0}%)`)
            }
        }
        return
    }

    if (!sightings || sightings.length === 0) {
        console.log('No recent sightings within 50km - trying without location filter...')

        // Fallback to all sightings
        const { data: allSightings } = await supabase
            .from('animals')
            .select('*')
            .eq('animal_type', lostAnimal.animal_type)
            .gte('spotted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .limit(50)

        if (!allSightings || allSightings.length === 0) {
            console.log('No recent sightings found at all')
            return
        }

        console.log(`Found ${allSightings.length} sightings (fallback)`)

        for (const sighting of allSightings) {
            console.log(`Comparing with sighting: ${sighting.id}`)
            const matchResult = await analyzeMatch(supabase, lostAnimal, sighting)

            if (matchResult && matchResult.confidence >= 80) {
                console.log(`✅ MATCH FOUND! Confidence: ${matchResult.confidence}%`)

                const { error: insertError } = await supabase
                    .from('lost_animal_matches')
                    .insert({
                        lost_animal_id: lostAnimal.id,
                        sighting_id: sighting.id,
                        confidence_score: matchResult.confidence,
                        match_reason: matchResult.reason,
                    })

                if (!insertError) {
                    await sendMatchNotification(supabase, lostAnimal, sighting, matchResult.confidence)
                }
            } else {
                console.log(`No match (confidence: ${matchResult?.confidence || 0}%)`)
            }
        }
        return
    }

    // Analyze each sighting for potential match
    console.log(`Analyzing ${sightings.length} sightings for matches...`)

    for (const sighting of sightings) {
        console.log(`Comparing with sighting: ${sighting.id}`)
        const matchResult = await analyzeMatch(supabase, lostAnimal, sighting)

        if (matchResult && matchResult.confidence >= 80) {
            console.log(`✅ MATCH FOUND! Confidence: ${matchResult.confidence}%`)

            // Insert match record
            const { error: insertError } = await supabase
                .from('lost_animal_matches')
                .insert({
                    lost_animal_id: lostAnimal.id,
                    sighting_id: sighting.id,
                    confidence_score: matchResult.confidence,
                    match_reason: matchResult.reason,
                })

            if (insertError) {
                console.error('Error inserting match:', insertError)
            } else {
                console.log('Match record inserted successfully')
            }
        } else {
            console.log(`No match (confidence: ${matchResult?.confidence || 0}%)`)
        }
    }
}

async function analyzeMatch(
    supabase: any,
    lostAnimal: any,
    sighting: any
): Promise<{ confidence: number; reason: string } | null> {
    try {
        // Pre-check: Animal types must match
        if (lostAnimal.animal_type !== sighting.animal_type) {
            console.log(`Type mismatch: ${lostAnimal.animal_type} vs ${sighting.animal_type}`);
            return { confidence: 0, reason: 'Different animal types (cat vs dog)' };
        }

        // Pre-check: If colors are explicitly different, skip AI call
        if (lostAnimal.color && sighting.color) {
            const lostColor = lostAnimal.color.toLowerCase();
            const sightingColor = sighting.color.toLowerCase();
            
            // Check for obvious color mismatches
            const colorMismatches = [
                ['white', 'orange'], ['white', 'black'], ['white', 'brown'],
                ['black', 'white'], ['black', 'orange'], 
                ['orange', 'white'], ['orange', 'black'],
            ];
            
            for (const [color1, color2] of colorMismatches) {
                if ((lostColor.includes(color1) && sightingColor.includes(color2)) ||
                    (lostColor.includes(color2) && sightingColor.includes(color1))) {
                    console.log(`Color mismatch: ${lostColor} vs ${sightingColor}`);
                    return { confidence: 0, reason: `Different colors: ${lostColor} vs ${sightingColor}` };
                }
            }
        }

        // Use OpenAI to compare the images and descriptions
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert at identifying and matching animals. Compare the lost animal with the sighting and determine if they could be the same animal. Return ONLY valid JSON.',
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: `You are comparing two animal photos to determine if they are the EXACT SAME individual animal.

LOST ANIMAL (Photo 1):
- Name: ${lostAnimal.name}
- Type: ${lostAnimal.animal_type}
- Breed: ${lostAnimal.breed || 'Unknown'}
- Color: ${lostAnimal.color || 'Unknown'}
- Description: ${lostAnimal.description}
- Distinctive features: ${lostAnimal.distinctive_features?.join(', ') || 'None listed'}

SIGHTING (Photo 2):
- Type: ${sighting.animal_type}
- Breed: ${sighting.breed || 'Unknown'}
- Color: ${sighting.color || 'Unknown'}
- Description: ${sighting.description || 'No description'}

CRITICAL MATCHING RULES - FOLLOW THESE EXACTLY:
1. SPECIES MUST MATCH: If one is a DOG and the other is a CAT, confidence MUST be 0%. DOGS AND CATS ARE NEVER THE SAME ANIMAL.
2. COLOR MUST MATCH: If one is white and the other is orange/brown/tabby, confidence MUST be 0%
3. PATTERN MUST MATCH: Solid color vs striped/tabby is NOT a match
4. SIZE MUST BE SIMILAR: A kitten cannot match an adult cat
5. DISTINCTIVE MARKINGS: Unique markings (spots, patches) must be present in both
6. BE VERY STRICT: Only high confidence (80%+) if you are certain it's the same individual animal
7. IF ANIMAL TYPES DON'T MATCH (cat vs dog), IMMEDIATELY return confidence: 0

EXAMINE CAREFULLY:
- Primary coat color (white, black, orange, gray, brown, etc.)
- Patterns (solid, tabby stripes, calico patches, tuxedo markings)
- Facial features and markings
- Eye color if visible
- Body size and build
- Any unique identifying marks

Return ONLY valid JSON (no markdown, no extra text):
{
  "isMatch": true or false,
  "confidence": number from 0 to 100,
  "reason": "detailed explanation comparing specific visual features, especially color"
}`,
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: lostAnimal.photo_url_1,
                                    detail: 'high',
                                },
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: sighting.image_url,
                                    detail: 'high',
                                },
                            },
                        ],
                    },
                ],
                max_tokens: 300,
                temperature: 0.3,
            }),
        })

        if (!openaiResponse.ok) {
            console.error('OpenAI error:', await openaiResponse.text())
            return null
        }

        const result = await openaiResponse.json()
        const content = result.choices[0].message.content

        console.log('OpenAI response content:', content)

        // Try to extract JSON from the response
        let analysis
        try {
            // Remove markdown code blocks if present
            const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
            const jsonMatch = cleanContent.match(/\{[\s\S]*\}/)
            analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleanContent)
        } catch (parseError) {
            console.error('Failed to parse OpenAI response:', parseError)
            console.error('Content was:', content)
            return null
        }

        console.log('Parsed analysis:', analysis)

        // Return the result regardless of match status (for logging)
        // Only create match record if confidence >= 80
        return {
            confidence: analysis.confidence || 0,
            reason: analysis.reason || 'No reason provided',
        }
    } catch (error) {
        console.error('Analysis error:', error)
        return null
    }
}

async function sendMatchNotification(
    supabase: any,
    lostAnimal: any,
    sighting: any,
    confidence: number
) {
    try {
        // Get user's push token
        const { data: profile } = await supabase
            .from('profiles')
            .select('push_token')
            .eq('id', lostAnimal.user_id)
            .single()

        if (!profile?.push_token) {
            console.log('No push token for user')
            return
        }

        // Send push notification via Expo
        await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: profile.push_token,
                title: '🔍 Potential Match Found!',
                body: `We found a ${confidence}% match for ${lostAnimal.name}. Tap to view.`,
                data: {
                    type: 'lost_animal_match',
                    lostAnimalId: lostAnimal.id,
                    sightingId: sighting.id,
                },
            }),
        })

        console.log('Notification sent successfully')
    } catch (error) {
        console.error('Notification error:', error)
    }
}
