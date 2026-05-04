import json
import os
import re
import anthropic
from datetime import datetime

# 讀取現有詞彙
with open('vocab.json', 'r', encoding='utf-8') as f:
    vocab = json.load(f)

existing_words = [v['en'].lower() for v in vocab]
existing_ids = [v['id'] for v in vocab]

# 計算各分類數量
cat_counts = {}
for v in vocab:
    cat_counts[v['cat']] = cat_counts.get(v['cat'], 0) + 1

print(f"目前詞彙數量：{len(vocab)}")
print(f"各分類：{cat_counts}")

# 每次每個分類各生成5個新詞彙
CATEGORIES = {
    'linux':   'Linux/Server 系統管理',
    'network': '網路/資安',
    'docker':  'Docker/容器化',
    'cloud':   '雲端/DevOps',
    'vmware':  'VMware/虛擬化',
    'bios':    'BIOS/硬體'
}

client = anthropic.Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])

new_vocab = []
timestamp = datetime.now().strftime('%m%d%H%M')

for cat, cat_name in CATEGORIES.items():
    # 取得該分類現有詞彙
    existing_in_cat = [v['en'] for v in vocab if v['cat'] == cat]
    existing_list = ', '.join(existing_in_cat[:30])  # 最多列30個避免太長
    
    prompt = f"""你是 MIS（IT管理員）的技術英文學習助手。
請生成 5 個「{cat_name}」分類的 MIS 技術英文詞彙或錯誤訊息。

以下詞彙已存在，絕對不能重複：{existing_list}

目標對象：台灣 MIS 工程師，英文底子弱，需要在工作中快速理解技術術語。

請嚴格只回傳 JSON 陣列，格式如下，不要有任何其他文字：
[
  {{
    "en": "英文術語或錯誤訊息",
    "zh": "中文意思（簡潔）",
    "cat": "{cat}",
    "lvl": 1,
    "cause": "為什麼會出現這個/這是什麼（一句話）",
    "fix": "怎麼解決或使用（指令或步驟）",
    "example": "MIS工作中實際會遇到的情境",
    "keyword": "記憶關鍵字1,記憶關鍵字2,記憶關鍵字3",
    "related": ["相關術語1", "相關術語2"]
  }}
]

lvl 說明：1=基礎必學, 2=進階, 3=專業深入
請確保詞彙對 MIS 日常工作有實際幫助。"""

    try:
        print(f"\n正在生成 {cat_name} 詞彙...")
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}]
        )
        
        raw = message.content[0].text.strip()
        # 清理 markdown code block
        raw = re.sub(r'```json\s*', '', raw)
        raw = re.sub(r'```\s*', '', raw)
        raw = raw.strip()
        
        words = json.loads(raw)
        
        # 過濾已存在的詞彙
        added = 0
        for w in words:
            if w['en'].lower() not in existing_words:
                # 生成唯一 ID
                w['id'] = f"{cat[0]}{timestamp}{len(new_vocab):02d}"
                w['source'] = 'auto'
                w['added_date'] = datetime.now().strftime('%Y-%m-%d')
                new_vocab.append(w)
                existing_words.append(w['en'].lower())
                added += 1
        
        print(f"  ✅ 成功新增 {added} 個詞彙")
        
    except Exception as e:
        print(f"  ❌ {cat_name} 生成失敗：{e}")
        continue

# 合併並儲存
if new_vocab:
    vocab.extend(new_vocab)
    with open('vocab.json', 'w', encoding='utf-8') as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)
    print(f"\n✅ 完成！新增 {len(new_vocab)} 個詞彙")
    print(f"✅ 詞彙總數：{len(vocab)} 個")
else:
    print("\n⚠️ 沒有新增任何詞彙")
