//
const P = {
    _ : null,
    b : '#000000', // black outline
    w : '#ffffff', // white
    r : '#880000', // dark red
    R : '#ff0000', // bright red
    g : '#006600', // dark green
    G : '#00ff00', // bright green
    B : '#5c3a21', // dark brown
    l : '#8b5a2b', // light brown
    s : '#555555', // iron dark
    S : '#aaaaaa', // iron light
    y : '#aa7700', // gold dark
    Y : '#ffcc00', // gold light
    m : '#003388', // mithril dark
    M : '#0088ff', // mithril light
    a : '#005522', // adamantite dark
    A : '#00ff66', // adamantite light
    c : '#111111', // coal dark
    C : '#333333', // coal light
    d : '#444444', // rock dark
    D : '#888888', // rock light
};

const itemSprites = {
    'wood': [
        "__bbbb__",
        "_bllllb_",
        "bllllllb",
        "bllllllb",
        "bllllllb",
        "bllllllb",
        "_bllllb_",
        "__bbbb__"
    ],
    'rock': [
        "__bbbb__",
        "_bDDDDb_",
        "bDddDDDb",
        "bDDdDDDb",
        "bDdddDDb",
        "bDDDDDDb",
        "_bDDDDb_",
        "__bbbb__"
    ],
    'apple': [
        "___bg___",
        "__bGg___",
        "_bRrRb__",
        "bRRRrRb_",
        "bRRRRRb_",
        "bRRRRRb_",
        "_bRRRb__",
        "__bbb___"
    ],
    'coin': [
        "__bbbb__",
        "_bYYYYb_",
        "bYYyyYYb",
        "bYyyyyYb",
        "bYyyyyYb",
        "bYYyyYYb",
        "_bYYYYb_",
        "__bbbb__"
    ],
    'pickaxe': [
        "_bbbbb__",
        "bDSDSDb_",
        "bDbDbb__",
        "_b_lb___",
        "___lb___",
        "___lb___",
        "___lb___",
        "___bb___"
    ],
    'axe': [
        "__bbbb__",
        "_bDDDb__",
        "_bDDb___",
        "__blb___",
        "__blb___",
        "__blb___",
        "__blb___",
        "__bbb___"
    ],
    'sword': [
        "_____b__",
        "____bSb_",
        "___bSSb_",
        "__bSSb__",
        "_bbb____",
        "__blb___",
        "__blb___",
        "__bbb___"
    ],
    'dagger': [
        "____b___",
        "___bRb__",
        "__bRRb__",
        "_bRRb___",
        "_bbb____",
        "__b_____",
        "________",
        "________"
    ],
    'sneakers': [
        "________",
        "________",
        "___bb___",
        "__bwwb__",
        "_bwwwbb_",
        "bwwwwwwb",
        "bbbbbbbb",
        "________"
    ],
    'dumbbell': [
        "________",
        "__bbb___",
        "_bsSsb__",
        "bsssssb_",
        "bsSssSb_",
        "bsssssb_",
        "_bsSsb__",
        "__bbb___"
    ],
    'workbench': [
        "__bbbb__",
        "_bllllb_",
        "bllllllb",
        "bbbbbbbb",
        "b__bb__b",
        "b__bb__b",
        "b__bb__b",
        "b__bb__b"
    ]
};

// Generate base64 data URIs for all textures
window.textureMap = {};

export function generateTextures() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    
    for (const [key, sprite] of Object.entries(itemSprites)) {
        ctx.clearRect(0, 0, 16, 16);
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const char = sprite[y][x];
                if (char !== '_') {
                    ctx.fillStyle = P[char];
                    ctx.fillRect(x * 2, y * 2, 2, 2);
                }
            }
        }
        window.textureMap[key] = canvas.toDataURL('image/png');
    }
}
