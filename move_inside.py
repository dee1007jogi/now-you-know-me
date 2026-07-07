import re

with open('public/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Extract the NEW RELOCATED ROUND CONTROLS block
start_str = '<!-- NEW RELOCATED ROUND CONTROLS -->'
end_str = '            </div>\n'
start_idx = content.find(start_str)
end_idx = content.find(end_str, start_idx) + len(end_str)

if start_idx != -1 and end_idx != -1:
    controls_block = content[start_idx:end_idx]
    
    # 2. Delete it from its current position
    content = content[:start_idx] + content[end_idx:]
    
    # 3. Restyle the block to fit inside the purple banner (remove white bg, change text to white)
    controls_block = controls_block.replace('background: #ffffff; border-radius: 30px; box-shadow: 0 10px 40px rgba(139, 92, 246, 0.08); padding: 25px 40px; margin-bottom: 30px;', 'margin-top: 30px; padding: 0;')
    controls_block = controls_block.replace('color: #64748b;', 'color: rgba(255,255,255,0.7);')
    controls_block = controls_block.replace('color: #1e293b;', 'color: white;')
    controls_block = controls_block.replace('border-left: 1px solid #f1f5f9;', 'border-left: 1px solid rgba(255,255,255,0.2);')
    
    # 4. Inject it inside .main-banner-content, right after <button class=" main-banner-btn\>Broadcast Alert</button>
 injection_point = content.find('<button class=\main-banner-btn\>Broadcast Alert</button>')
 if injection_point != -1:
 injection_point += len('<button class=\main-banner-btn\>Broadcast Alert</button>')
 content = content[:injection_point] + '\n' + controls_block + content[injection_point:]

 with open('public/admin.html', 'w', encoding='utf-8') as f:
 f.write(content)
 print(\Successfully moved controls inside the banner.\)
