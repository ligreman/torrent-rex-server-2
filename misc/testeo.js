var Q = require('q'),
    http = require('http'),
    util = require('util'),
    mongoose = require('mongoose'),
    modelos = require('./models/trex-models.js'),
    request = require('request');

console.log("inicio");

mongoose.connect(process.env.OPENSHIFT_MONGODB_DB_URL + process.env.OPENSHIFT_APP_NAME || 'mongodb://localhost/trex', {
    db: {safe: true}
});

modelos.SeriesT.find({}, function (err, docs) {
    if (err) {
        response = {servers: null, error: "Se produjo un error"};
        res.send(response);
        throw "Error: 500";
    }
    console.log("Encuentro:");
    console.log(docs);


});


/*Q.when(a('http://es.web.img3.acsta.net/cx_160_213/b_1_d6d6d6/pictures/15/02/06/14/05/242395.jpg'), function () {
 console.log("yessooo");
 return true;
 });*//*
 a('http://es.web.img3.acsta.net/cx_160_213/b_1_d6d6d6/pictures/15/02/06/14/05/242395.jpg')
 .then(function (cuerpo) {
 console.log("then");
 //var b = btoa(cuerpo);

 var reader = new FileReader();
 reader.onload = (function (self) {
 return function (e) {
 console.log(e.target.result);
 }
 })(this);

 reader.readAsBinaryString(cuerpo);

 //console.log(cuerpo);
 }, function (error) {
 console.error(error);
 });*/

var url = 'http://es.web.img3.acsta.net/cx_160_213/b_1_d6d6d6/pictures/15/02/06/14/05/242395.jpg';

/*request(
 {url: url, encoding: 'binary'},
 function onImageResponse(error, imageResponse, imageBody) {
 if (error) throw error;

 var imageType = imageResponse.headers['content-type'];
 var base64 = new Buffer(imageBody, 'binary').toString('base64');
 var dataURI = 'data:' + imageType + ';base64,' + base64;
 var jsonString = JSON.stringify({
 code: imageResponse.statusCode,
 desc: http.STATUS_CODES[imageResponse.statusCode],
 type: imageType,
 orig: url,
 data: dataURI
 });

 console.log(jsonString);
 }
 );*/

/*
 downloadImage(url).then(function (imagen) {
 console.log(imagen);
 });
 */

console.log("esperando");
console.log("end");

function downloadImage(url) {
    var def = Q.defer();

    request(
        {url: url, encoding: 'binary'},
        function onImageResponse(error, imageResponse, imageBody) {
            if (error) {
                def.reject(error);
                throw error;
            }

            var imageType = imageResponse.headers['content-type'];
            var size = imageResponse.headers['content-length'];
            var base64 = new Buffer(imageBody, 'binary').toString('base64');
            var dataURI = 'data:' + imageType + ';base64,' + base64;
            var jsonString = JSON.stringify({
                code: imageResponse.statusCode,
                desc: http.STATUS_CODES[imageResponse.statusCode],
                type: imageType,
                orig: url,
                data: dataURI
            });

            def.resolve(jsonString);
        }
    );

    return def.promise;
}


function a(url) {
    var def = Q.defer();

    /*
     http.get(url, function (res) {
     console.log("resolveo");
     def.resolve(res);
     }).on('error', function (e) {
     console.log("rechaceo");
     def.reject(res);
     });*/

    request(url, function (err, resp, body) {
        if (err) {
            def.reject(err);
        } else {
            def.resolve(body);
        }
    });

    return def.promise;
}