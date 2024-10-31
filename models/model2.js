async function callModel2(query) {
    // 模型2的API调用逻辑
    const apiUrl = 'https://api.model2.com/v1/query';

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
        return { success: true, response: data.response };
    } catch (error) {
        console.error('Error calling Model2:', error);
        return { success: false, response: 'AI: 出现错误，请稍后再试。' };
    }
} 