// var Agent = require("agentkeepalive");
// var Bagpipe = require('bagpipe');
// var conf = require('./auth.conf').jielv;
// var dateformat = require("dateformat");
// var fs = require("fs");
// var http = require('http');

// var bagpipe = new Bagpipe(100);
// var host = conf["host"] || "chstravel.com";
// var port = conf["port"] || "30000";
// var options = {
//     host: host,
//     port: port,
//     path: "/commonQueryServlet",
//     method: "POST",
//     agent: (new Agent({
//         maxSockets: 50,
//         keepAlive: true
//     })),
//     headers: {
//         "Cache-Control": "no-cache",
//         "Pragma": "no-cache",
//         "Host": host + ":" + port,
//         "Content-Length": 0
//     }
// };

// showMem();
// var start = Date.now();
// var hotelIds;
// var i = 0, j;
// for (; i < 5000; i += 1) {
//     hotelIds = [];
//     for (j = (i * 20 + 1); j <= ((i + 1) * 20); j += 1) hotelIds.push(j);
//     hotelIds = hotelIds.join("/");
//     bagpipe.push(jielvrequest, {
//         "QueryType": "hotelinfo",
//         "hotelIds": hotelIds
//     }, function(result) {
//         showMem();
//     });
// }

// function jielvrequest(data, callback) {
//     data["Usercd"] = conf["Usercd"];
//     data["Authno"] = conf["Authno"];
//     data = new Buffer(JSON.stringify(data), "utf8");
//     options.headers["Content-Length"] = data.length;

//     var result = new Buffer('');
//     var request = http.request(options, function(response) {
//         response.on('data', function(chunk) {result = Buffer.concat([result, chunk]);});
//         response.on('end', function() {
//             try {
//                 result = '(' + result + ')';
//                 result = eval(result);

//                 var time = dateformat(new Date(), "[yyyy-mm-dd HH:MM:ss]");
//                 if (result && result.success == 8)
//                     console.log(time, "jielv.ERROR", JSON.stringify(result.msg));

//                 callback(result);
//             } catch(e) {
//                 callback(null);
//             }
//         });
//     });

//     request.setTimeout(1000 * 60);
//     request.on('error', function(e) {callback(null);});
//     request.write(data, 'utf8');
//     request.end();
// }

// function showMem() {
//     var mem = process.memoryUsage();
//     var format = function(bytes) {
//         return (bytes / 1024 / 1024).toFixed(2) + "MB";
//     };
//     console.log("Process: heapTotal", format(mem.heapTotal), "heapUsed", format(mem.heapUsed), "rss", format(mem.rss));
// }
process.on('message', function(roomtypeids) {
    console.log(JSON.stringify(roomtypeids, null, 4));
});
