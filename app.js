const WebSocket = require('ws');
var fs = require('fs');
var youtubedl = require('youtube-dl');
var crypto = require('crypto');
var qs = require('qs');
var request = require('request');

var server = 'wss://my.webhookrelay.com/v1/socket';
var reconnectInterval = 1000 * 3;
var ws;

var apiKey = process.env.RELAY_KEY;
var apiSecret = process.env.RELAY_SECRET;

var connect = function () {
    ws = new WebSocket(server);
    ws.on('open', function () {
        console.log('Connected, sending authentication request');
        ws.send(JSON.stringify({ action: 'auth', key: apiKey, secret: apiSecret }));
    });

    ws.on('message', function incoming(data) {
        //   console.log(data)
        var msg = JSON.parse(data);
        if (msg.type === 'status' && msg.status === 'authenticated') {
            console.log('Authenticated, subscribing to the bucket...')
            ws.send(JSON.stringify({ action: 'subscribe', buckets: ['slash'] }));
            return
        }

        if (msg.type === 'webhook') {
            processWebhook(qs.parse(msg.body))
        }
    });

    ws.on('error', function () {
        console.log('socket error');
    });

    ws.on('close', function () {
        console.log('socket closed, reconnecting');
        setTimeout(connect, reconnectInterval);
    });
};

var processWebhook = function (payload) {
    console.log('URL: ', payload.text)

    var tempFilename = 'tmp-' + crypto.randomBytes(4).readUInt32LE(0);
    var actualFilename = ''

    var video = youtubedl(payload.text,
        ['--format=18'],
        { cwd: __dirname });

    // Will be called when the download starts.
    video.on('info', function (info) {
        console.log('Download started');
        console.log('Filename: ' + info._filename);
        // saving filename for the later rename
        actualFilename = info._filename;
        console.log('Size: ' + info.size);
    });

    video.pipe(fs.createWriteStream(tempFilename));

    video.on('end', function () {
        console.log('Finished downloading!');

        // renaming file to the actual video name from our temp one
        if (actualFilename !== '') {
            fs.rename(tempFilename, actualFilename, function (err) {
                if (err) console.log('ERROR: ' + err);
            });
        }
        // sending response back to Slack
        respond(payload, {
            response_type: 'in_channel',
            text: `${actualFilename} finished downloading!`
        })
    });
}

var respond = function (payload, result) {
    request.post(
        payload.response_url,
        { json: result },
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body)
                return
            }
            console.log(error)
        }
    );
}

connect();