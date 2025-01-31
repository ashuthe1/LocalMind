## **Example Workflow**

1. **Start a New Chat**: Send a message to create a new chat.

   ```bash
   curl -X POST http://localhost:8080/api/chat \
        -H "Content-Type: application/json" \
        -d '{
              "message": "What is the weather today?",
              "model": "deepseek"
            }'
   ```

2. **Store the Chat ID**: Note the `id` from the response.

3. **Continue the Chat**: Send another message using the same `chatId`.

   ```bash
   curl -X POST http://localhost:8080/api/chat \
        -H "Content-Type: application/json" \
        -d '{
              "message": "Will it rain tomorrow?",
              "chatId": "YOUR_CHAT_ID",
              "model": "deepseek"
            }'
   ```

4. **List All Chats**: Retrieve all chats to see the list of chat sessions.

   ```bash
   curl -X GET http://localhost:8080/api/chats
   ```

5. **Delete a Chat**: Remove a specific chat.

   ```bash
   curl -X DELETE http://localhost:8080/api/chat/YOUR_CHAT_ID
   ```

6. **Delete All Chats**: Remove all chats from the database.

   ```bash
   curl -X DELETE http://localhost:8080/api/chats
   ```

---