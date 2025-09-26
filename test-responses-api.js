// Quick test to verify OpenAI Responses API functionality
import OpenAI from 'openai';

async function testResponsesAPI() {
    try {
        const client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || 'sk-test'
        });
        
        console.log('OpenAI client created');
        console.log('Client has responses property:', 'responses' in client);
        console.log('Responses property type:', typeof client.responses);
        
        if (client.responses && typeof client.responses.create === 'function') {
            console.log('✅ client.responses.create method is available');
            
            // Try to make an actual API call (will fail with fake key but should validate the interface)
            if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')) {
                console.log('Making test API call...');
                const response = await client.responses.create({
                    model: 'gpt-4o',
                    input: 'Hello, can you tell me what 2+2 equals?',
                    text: { verbosity: 'medium' }
                });
                console.log('✅ API call successful');
                console.log('Response type:', typeof response);
                console.log('Response keys:', Object.keys(response));
            } else {
                console.log('⚠️ No valid API key - skipping actual API call');
            }
        } else {
            console.log('❌ client.responses.create method not found');
        }
        
    } catch (error) {
        console.log('Error:', error.message);
        if (error.message.includes('Invalid API key')) {
            console.log('✅ API endpoint is reachable (just invalid key)');
        }
    }
}

testResponsesAPI().catch(console.error);