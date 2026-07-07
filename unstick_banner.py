import re

with open('public/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Locate the banner
start_str = '<div class=" main-banner-3d\>'
end_str = ' </div>\n <!-- SCROLLABLE VIEWS CONTAINER -->'
# Actually the banner ends right before <div id=\adminMsg\ or <div class=\views-container\>
start_idx = content.find(start_str)

# Find the end of the banner block
# The banner has 2 closing divs at the end. Let's find <div id=\adminMsg\ which is right after it.
msg_idx = content.find('<div id=\adminMsg\')
if start_idx != -1 and msg_idx != -1:
 # The banner block is from start_idx up to msg_idx
 banner_block = content[start_idx:msg_idx]
 
 # Remove it from its current position
 content = content[:start_idx] + content[msg_idx:]
 
 # Inject it inside the views-container, specifically inside tabIntelligenceContent so it scrolls with that tab
 tab_idx = content.find('<div id=\tabIntelligenceContent\ class=\hidden\>')
 if tab_idx != -1:
 tab_start_tag = '<div id=\tabIntelligenceContent\ class=\hidden\>'
 tab_idx += len(tab_start_tag)
 content = content[:tab_idx] + '\n' + banner_block + content[tab_idx:]

with open('public/admin.html', 'w', encoding='utf-8') as f:
 f.write(content)
