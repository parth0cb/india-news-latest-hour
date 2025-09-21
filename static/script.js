document.addEventListener("DOMContentLoaded", function () {
    const fetchDataButton = document.getElementById("fetch-news-button");
    const summaryTypeInput = document.getElementById("summary-type-input");
    const resultsDiv = document.getElementById("results");
    const tokenInfoDiv = document.getElementById("tokenInfo");
    const copyAllButton = document.getElementById("copy-all-button")
    const copyAllButtonContainer = document.getElementById("copy-all-button-container")
    let currentController = null; // <- track the current AbortController
    
    // Event delegation for copy buttons
    resultsDiv.addEventListener('click', function(e) {
        if (e.target.classList.contains('copy-button')) {
            const wrapper = e.target.parentNode;
            const paragraph = wrapper.querySelector('p');
            const textToCopy = paragraph.textContent;
            
            navigator.clipboard.writeText(textToCopy).then(() => {
                e.target.textContent = 'Copied!';
                setTimeout(() => {
                    e.target.textContent = 'Copy';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy: ', err);
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = textToCopy;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                e.target.textContent = 'Copied!';
                setTimeout(() => {
                    e.target.textContent = 'Copy';
                }, 2000);
            });
        }
    });

    copyAllButton.addEventListener("click", function () {
        const paragraphs = resultsDiv.querySelectorAll("p");
        const combinedText = Array.from(paragraphs)
            .map(p => p.textContent.trim())
            .join("\n\n");

        navigator.clipboard.writeText(combinedText)
            .then(() => {
                copyAllButton.textContent = 'All Copied!';
                setTimeout(() => {
                    copyAllButton.textContent = 'Copy All';
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy all: ', err);
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = combinedText;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);

                copyAllButton.textContent = 'All Copied!';
                setTimeout(() => {
                    copyAllButton.textContent = 'Copy All';
                }, 2000);
            });
    })
    
    fetchDataButton.addEventListener("click", function () {
        // cancel any previous request
        if (currentController) {
            currentController.abort();
        }
        // new AbortController
        currentController = new AbortController();
        copyAllButtonContainer.style.display = 'none'
        resultsDiv.innerHTML = "";
        tokenInfoDiv.querySelectorAll("span")[0].textContent = "Input Tokens: 0";
        tokenInfoDiv.querySelectorAll("span")[2].textContent = "Output Tokens: 0";
        const summaryType = summaryTypeInput.value;
        fetch("/app", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ summary_type: summaryType }),
            signal: currentController.signal, // signal to fetch
        })
            .then(response => {
                if (!response.ok) throw new Error("Network response was not ok.");
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";
                function readStream() {
                    return reader.read().then(({ done, value }) => {
                        if (done) {
                            processBuffer(buffer);
                            return;
                        }
                        buffer += decoder.decode(value, { stream: true });
                        let lines = buffer.split("\n");
                        buffer = lines.pop();
                        for (const line of lines) {
                            if (line.trim() !== "") {
                                processLine(line);
                            }
                        }
                        return readStream();
                    });
                }
                return readStream();
            })
            .catch(error => {
                if (error.name === "AbortError") {
                    console.log("Previous request aborted.");
                    return;
                }
                console.error("Error fetching data:", error);
                resultsDiv.innerHTML = `<p class="error">Error: ${error.message}</p>`;
            });
        
        function processLine(line) {
            let parsed;
            try {
                parsed = JSON.parse(line);
            } catch (e) {
                console.warn("Skipping invalid JSON:", line);
                return;
            }
            switch (parsed.type) {
                case "log":
                    resultsDiv.innerHTML = `<div class="loading-container"><div class="spinner"></div><div class="log">${parsed.content}</div></div>`;
                    break;
                case "token_usage":
                    updateTokenInfo(parsed.content);
                    break;
                case "error":
                    resultsDiv.innerHTML = `<div class="error">${parsed.content}</div>`;
                    break;
                case "news":
                    resultsDiv.innerHTML = addCopyButtons(parsed.content);
                    copyAllButtonContainer.style.display = 'block';
                    break;
                default:
                    console.warn("Unknown type:", parsed.type);
            }
        }
        
        function processBuffer(lastChunk) {
            if (lastChunk.trim() !== "") {
                processLine(lastChunk);
            }
        }
        
        function updateTokenInfo(tokenData) {
            tokenInfoDiv.querySelectorAll("span")[0].textContent = `Input Tokens: ${tokenData.prompt_tokens}`;
            tokenInfoDiv.querySelectorAll("span")[2].textContent = `Output Tokens: ${tokenData.completion_tokens}`;
        }
        
        function addCopyButtons(newsContent) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newsContent;
            
            const paragraphs = tempDiv.querySelectorAll('p');
            paragraphs.forEach(p => {
                // Create wrapper div for positioning
                const wrapper = document.createElement('div');
                wrapper.style.position = 'relative';
                wrapper.style.marginBottom = '10px';
                
                // Create copy button
                const copyButton = document.createElement('button');
                copyButton.className = 'copy-button';
                copyButton.textContent = 'Copy';
                copyButton.style.position = 'absolute';
                copyButton.style.top = '5px';
                copyButton.style.right = '5px';
                copyButton.style.zIndex = '10';
                
                // Wrap the paragraph
                p.parentNode.insertBefore(wrapper, p);
                wrapper.appendChild(p);
                wrapper.appendChild(copyButton);
            });
            
            return `<div class="news">${tempDiv.innerHTML}</div>`;
        }
    });
});
