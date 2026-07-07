with open('public/admin.html', 'r', encoding='utf-8') as f:
    c = f.read()
c = c.replace('/* PURPLE 3D GAMING THEME OVERRIDES (Injected) */', '<style>\n/* PURPLE 3D GAMING THEME OVERRIDES (Injected) */')
with open('public/admin.html', 'w', encoding='utf-8') as f:
    f.write(c)
