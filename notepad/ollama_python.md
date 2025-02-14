# Ollama Python Library Notes

## Prerequisites
- Install and run [Ollama](https://ollama.com/download).
- Pull a model: `ollama pull <model>` (e.g., `ollama pull llama3.2`).

## Installation
```sh
pip install ollama
```

## Usage Examples

1. **Basic Chat**
   ```python
   from ollama import chat, ChatResponse
   
   response = chat(model='llama3.2', messages=[
       {'role': 'user', 'content': 'Why is the sky blue?'},
   ])
   
   print(response['message']['content'])
   # or directly access fields:
   print(response.message.content)
   ```

2. **Streaming Responses**
   ```python
   from ollama import chat
   
   stream = chat(
       model='llama3.2',
       messages=[{'role': 'user', 'content': 'Why is the sky blue?'}],
       stream=True,
   )
   
   for chunk in stream:
       print(chunk['message']['content'], end='', flush=True)
   ```

3. **Custom Client**
   ```python
   from ollama import Client
   
   client = Client(
       host='http://localhost:11434',
       headers={'x-some-header': 'some-value'}
   )
   
   response = client.chat(model='llama3.2', messages=[
       {'role': 'user', 'content': 'Why is the sky blue?'},
   ])
   ```

4. **Async Client**
   ```python
   import asyncio
   from ollama import AsyncClient
   
   async def chat():
       message = {'role': 'user', 'content': 'Why is the sky blue?'}
       response = await AsyncClient().chat(model='llama3.2', messages=[message])
   
   asyncio.run(chat())
   ```

5. **Async Streaming**
   ```python
   import asyncio
   from ollama import AsyncClient
   
   async def chat():
       message = {'role': 'user', 'content': 'Why is the sky blue?'}
       async for part in await AsyncClient().chat(model='llama3.2', messages=[message], stream=True):
           print(part['message']['content'], end='', flush=True)
   
   asyncio.run(chat())
   ```

## API Functions

- **Chat**: `ollama.chat(model, messages)`
- **Generate**: `ollama.generate(model, prompt)`
- **List Models**: `ollama.list()`
- **Show Model Info**: `ollama.show(model)`
- **Create New Model**: `ollama.create(model, from_, system)`
- **Copy Model**: `ollama.copy(src_model, dest_model)`
- **Delete Model**: `ollama.delete(model)`
- **Pull Model**: `ollama.pull(model)`
- **Push Model**: `ollama.push(model)`
- **Embed Text**: `ollama.embed(model, input)` (single or batch)

## Error Handling
```python
model = 'does-not-yet-exist'

try:
    ollama.chat(model)
except ollama.ResponseError as e:
    print('Error:', e.error)
    if e.status_code == 404:
        ollama.pull(model)
```

## Example of Structured Outputs

```python
from pydantic import BaseModel
from ollama import chat


# Define the schema for the response
class FriendInfo(BaseModel):
    name: str
    age: int
    is_available: bool


class FriendList(BaseModel):
    friends: list[FriendInfo]


response = chat(
    model='llama3.1:8b',
    messages=[{'role': 'user', 'content': 'I have two friends. The first is Ollama 22 years old busy saving the world, and the second is Alonso 23 years old and wants to hang out. Return a list of friends in JSON format'}],
    format=FriendList.model_json_schema(),  # Use Pydantic to generate the schema or format=schema
    options={'temperature': 0},  # Make responses more deterministic
)

# Use Pydantic to validate the response
friends_response = FriendList.model_validate_json(response.message.content)
print(friends_response)
```
