var http = require('http');
var headers = {};
var data = {
    'Usercd': 'SZ2747',
    'Authno': '123456',
    'QueryType': 'hotelpriceall',
    'hotelIds': '1/2/3',
    'checkInDate': '2014-03-04',
    'checkOutDate': '2014-03-08'
};

data = JSON.stringify(data);
data = new Buffer(data, 'utf8');
headers["Cache-Control"] = "no-cache";
headers["Pragma"] = "no-cache";
headers['Host'] = "chstravel.com:30000";
headers["Content-Length"] = data.length;

var options = {
    host: "chstravel.com",
    port: "30000",
    path: "/commonQueryServlet",
    method: "POST",
    headers: headers
};

var result = "";
var request = http.request(options, function(response) {
    response.on('data', function(chunk) {
        result += chunk;
    });
    response.on('end', function() {
        try {
            result = '(' + result + ')';
            result = eval(result);
            console.log(result);
        } catch(e) {
            console.log(e);
        }
    });
});

request.write(data, 'utf8');
request.end();
