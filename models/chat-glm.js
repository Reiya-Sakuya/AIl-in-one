async function callChatGLMModel(query) {
    // 假设ChatGLM模型的API端点
    const apiUrl = 'https://api.chatglm.com/v1/query';

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_API_KEY' // 确保替换为你的API密钥
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.response; // 假设API返回的响应在data.response中
    } catch (error) {
        console.error('Error calling ChatGLM model:', error);
        return 'AI: 出现错误，请稍后再试。';
    }
}

async function callAIModels(query) {
    // 调用ChatGLM模型
    const response = await callChatGLMModel(query);
    displayResponse(response);
}

function displayResponse(response) {
    const responseBox = document.getElementById('responseBox');
    responseBox.innerHTML += `<div>${response}</div>`;
} 