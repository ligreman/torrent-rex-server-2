var fs = require('fs');

try
{
fs.mkdirSync('D:\\patata');	
}
catch (err)
{
	console.log(err);
}
