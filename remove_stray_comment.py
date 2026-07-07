with open('public/admin.html', 'r', encoding='utf-8') as f:
    c = f.read()
c = c.replace('/* ------------------------------------------------------------------- */\n        <style>', '<style>')
c = c.replace('/* ------------------------------------------------------------------- */\r\n        <style>', '<style>')
with open('public/admin.html', 'w', encoding='utf-8') as f:
    f.write(c)
