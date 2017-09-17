'use strict';

// Dependencias
var express = require('express'),
    app = express(),
    http = require('http'),
    mongoose = require('mongoose'),
    server = http.createServer(app),
    port = process.env.TREX_SERVER_SERVICE_PORT || 80,
    ip = process.env.TREX_SERVER_SERVICE_HOST || '127.0.0.1'; //'0.0.0.0'

// Configuramos la app para que pueda realizar métodos REST
app.configure(function () {
    app.use(express.bodyParser()); // JSON parsing
    app.use(express.compress());
    //app.use(express.methodOverride()); // HTTP PUT and DELETE support
    app.use(app.router); // simple route management
});

// CORSAdd headers
app.use(function (req, res, next) {
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost');
    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

//Cargo rutas
var tt = require('./routes/trex')(app);

mongoose.set('debug', false);

/*//Inicio conexión de mongo
 var dbTrex = mongoose.createConnection(process.env.OPENSHIFT_MONGODB_DB_URL + process.env.OPENSHIFT_APP_NAME || 'mongodb://localhost/trex', {
 db: {safe: true}
 });
 var dbCine = mongoose.createConnection(process.env.OPENSHIFT_MONGODB_DB_URL + process.env.OPENSHIFT_APP_NAME || 'mongodb://localhost/cine', {
 db: {safe: true}
 });

 //Modo debug
 dbTrex.set('debug', true);
 dbCine.set('debug', true);
 dbTrex.on('error', console.error.bind(console, 'Error conectando a MongoDB:'));
 dbCine.on('error', console.error.bind(console, 'Error conectando a MongoDB:'));
 dbTrex.on("connected", console.log.bind(console, 'Conectado a MongoDB'));
 dbCine.on("connected", console.log.bind(console, 'Conectado a MongoDB'));*/


// Si no se "queda" en una de las rutas anteriores, devuelvo un 404 siempre
app.use(function (req, res) {
    res.send(404);
});

// El servidor escucha en el puerto 3000
server.listen(port, ip, function () {
    console.log('Node server running on ' + ip + ' ' + port);
});

//Si salta alguna excepción rara, saco error en vez de cerrar la aplicación
process.on('uncaughtException', function (err) {
    // handle the error safely
    console.log("ERROR - " + err);
});


//Controlamos el cierre para desconectar mongo
process.stdin.resume();//so the program will not close instantly

//do something when app is closing
process.on('exit', exitHandler.bind(null, {exit: true}));
//catches ctrl+c event
//En caso de error desconecto de mongo
process.on('SIGINT', exitHandler.bind(null, {exit: true}));
process.on('SIGTERM', exitHandler.bind(null, {exit: true}));


function exitHandler(options, err) {
    if (options.exit) {
        process.exit();
    }
}
