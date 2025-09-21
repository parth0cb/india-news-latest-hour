import requests
from bs4 import BeautifulSoup
from dateutil import parser as dateparser
from datetime import datetime, timedelta, timezone
from openai import OpenAI
from typing import TypedDict
import markdown
import traceback

def lookback_news_from_india(
    api_key: str,
    base_url: str,
    language_model: str,
    lookback_minutes: int = 60,
    summary_type: str = "one sentence"
):

    yield {"type": "log", "content": f"Searching for news from India in the last {lookback_minutes} minutes..."}

    resp = requests.get('https://www.thehindu.com/latest-news/')
    soup = BeautifulSoup(resp.text, 'html.parser')

    articles = soup.select('ul.timeline-with-img li .element')
    now = datetime.now(timezone.utc).astimezone()
    summaries = []
    summaries_with_metadata = []
    prompt_tokens = 0
    completion_tokens = 0

    for article in articles:

        time_div = article.select_one('.news-time.time')
        if not time_div or not time_div.has_attr('data-published'):
            continue

        published_time = dateparser.parse(time_div['data-published'])
        if now - published_time > timedelta(minutes=lookback_minutes):
            break

        article_title = article.select_one('h3.title a')
        if not article_title:
            continue
        article_url = article_title['href']

        article_resp = requests.get(article_url)
        article_soup = BeautifulSoup(article_resp.text, 'html.parser')
        paragraphs = article_soup.find_all('p')
        full_text = "\n".join(p.get_text().strip() for p in paragraphs if p.get_text().strip())

        if not full_text:
            continue

        client = OpenAI(
            api_key = api_key,
            base_url = base_url,
        )

        prompt = f"Summarize the following news article in {summary_type}. Sumarize the information in the article without mentioning the article itself. Also, do not mention date unless the news is date specific.\n\nNews article:\n\n{full_text}\n\n---\nSummary:"

        try:
            response = client.chat.completions.create(
                model=language_model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that summarizes news articles"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
            )
            summary = response.choices[0].message.content
            summaries.append(summary)

            if response.usage:
                prompt_tokens += response.usage.prompt_tokens
                completion_tokens += response.usage.completion_tokens
                yield {
                    "type": "token_usage",
                    "content": {
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens
                    },
                }

            yield {"type": "log", "content": f"Found {len(summaries)} articles"}
            
        except Exception as e:
            traceback.print_exc()
            yield {"type": "error", "content": str(e)}


    final_result = "\n\n---\n\n".join(summaries)
    final_result_md = markdown.markdown(final_result, extensions=['fenced_code'])
    yield {"type": "news", "content": final_result_md}

