const fs = require('fs');
const https = require('https');
const TelegramBot = require('node-telegram-bot-api');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

const token = config.token;
const downloadDir = config.download_dir;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

let now = function () {
    return Math.floor(new Date() / 1000);
};

let downloadFile = function (fileId) {
    bot.getFileLink(fileId).then((fileUri) => {
        let time = process.hrtime();
        let extension = fileUri.split('.').pop();
        let newName = `${time[0]}${time[1]}.${extension}`;
        let file = fs.createWriteStream(`${downloadDir}/${newName}`);
        let request = https.get(fileUri, (response) => {
            response.pipe(file);
        });
        console.log(fileUri);
    });
};

let statusUpdater = {
    lastTick: Math.floor(new Date() / 1000),
    nextNotification: false,
    fileCount: 0,
    chats: null
};

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    let fileId = null;

    if (typeof msg.photo !== 'undefined') {
        let maxRes = 0, selected = 0;
        for (let i in msg.photo) {
            let resolution = msg.photo[i].width * msg.photo[i].height;
            if (resolution > maxRes) {
                selected = i;
                maxRes = resolution;
            }
        }

        fileId = msg.photo[selected].file_id;
    } else if (typeof msg.document !== 'undefined') {
        fileId = msg.document.file_id;
    }

    if (fileId !== null) {
        statusUpdater.nextNotification = now() + 1;
        statusUpdater.fileCount += 1;
        statusUpdater.chat = chatId;
        downloadFile(fileId);
    }
});

let clock = setInterval(() => {
    if (statusUpdater.nextNotification !== false && statusUpdater.chat !== null
        && statusUpdater.nextNotification < now()) {
        let message = statusUpdater.fileCount > 1 ? config.notification_plural : config.notification_single;
        bot.sendMessage(statusUpdater.chat, message.replace(/%d/, statusUpdater.fileCount));

        statusUpdater.nextNotification = false;
        statusUpdater.fileCount = 0;
        statusUpdater.chat = null;
    }
}, 1000);