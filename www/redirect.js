var http = require("http");

http.createServer(function(req, res) {
    res.writeHead(301, {
        "location": "http://121.196.142.144/"
    });
    res.end();
}).listen(8360, "127.0.0.1");
