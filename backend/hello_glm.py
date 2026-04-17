from dotenv import load_dotenv
import os
from openai import OpenAI  

load_dotenv()

client = OpenAI(
    api_key=os.getenv("Z.AI_API_KEY"),    
    base_url=os.getenv("Z.AI_BASE_URL"), 
)

response = client.chat.completions.create(
    model="GLM-4.5-Flash",
    messages=[
        {"role": "system", "content": "You are a Malaysian tax assistant."},
        {"role": "user", "content": "What is SST?"}
    ]
)

print(response.choices[0].message.content)