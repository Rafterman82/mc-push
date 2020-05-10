'use strict';

// Module Dependencies
const axios 			= require('axios');
var express     		= require('express');
var bodyParser  		= require('body-parser');
var errorhandler 		= require('errorhandler');
var http        		= require('http');
var path        		= require('path');
var request     		= require('request');
var routes      		= require('./routes');
var activity    		= require('./routes/activity');
var urlencodedparser 	= bodyParser.urlencoded({extended:false});
var app 				= express();
var local       		= false;


// access Heroku variables
if ( !local ) {
	var marketingCloud = {
	  authUrl: 						process.env.authUrl,
	  clientId: 					process.env.clientId,
	  clientSecret: 				process.env.clientSecret,
	  restUrl: 						process.env.restUrl,
	  appUrl: 						process.env.baseUrl,
	  controlGroupsDataExtension: 	process.env.controlGroupsDataExtension,
	  updateContactsDataExtension: 	process.env.updateContactsDataExtension,
	  promotionsDataExtension: 		process.env.promotionsDataExtension,
	  insertDataExtension: 			process.env.insertDataExtension
	};
	console.dir(marketingCloud);
}

// url constants
const controlGroupsUrl 	= marketingCloud.restUrl + "data/v1/customobjectdata/key/" 	+ marketingCloud.controlGroupsDataExtension 	+ "/rowset";
const updateContactsUrl = marketingCloud.restUrl + "data/v1/customobjectdata/key/" 	+ marketingCloud.updateContactsDataExtension 	+ "/rowset";
const promotionsUrl 	= marketingCloud.restUrl + "data/v1/customobjectdata/key/" 	+ marketingCloud.promotionsDataExtension 		+ "/rowset";
const insertUrl 		= marketingCloud.restUrl + "data/v1/customobjectdata/key/" 	+ marketingCloud.insertDataExtension 			+ "/rowset";

// Configure Express master
app.set('port', process.env.PORT || 3000);
app.use(bodyParser.raw({type: 'application/jwt'}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Express in Development Mode
if ('development' == app.get('env')) {
	app.use(errorhandler());
}

const getOauth2Token = () => new Promise((resolve, reject) => {
	axios({
		method: 'post',
		url: marketingCloud.authUrl,
		data:{
			"grant_type": "client_credentials",
			"client_id": marketingCloud.clientId,
			"client_secret": marketingCloud.clientSecret
		}
	})
	.then(function (oauthResponse) {
		console.dir('Bearer '.concat(oauthResponse.data.access_token));
		return resolve('Bearer '.concat(oauthResponse.data.access_token));
	})
	.catch(function (error) {
		console.dir("Error getting Oauth Token");
		return reject(error);
	});
});

const addQueryActivity = (payload) => new Promise((resolve, reject) => {

	getOauth2Token().then((tokenResponse) => {

		console.dir("Oauth Token");
		console.dir(tokenResponse);
	var communicationCellData = {
			"not_control": {
		    	"cell_code"					: payload["cell_code"],
		    	"cell_name"					: payload["cell_name"],
		        "campaign_name"				: payload["campaign_name"],
		        "campaign_id"				: payload["campaign_id"],
		        "campaign_code"				: payload["campaign_code"],
		        "cell_type"					: "1",
		        "channel"					: "2",
		        "is_putput_flag"			: "1"				
			}
	};
	   	axios({
			method: 'post',
			url: targetUrl,
			headers: {'Authorization': tokenResponse},
			data: insertPayload
		})
		.then(function (response) {
			console.dir(response.data);
			return resolve(response.data);
		})
		.catch(function (error) {
			console.dir(error);
			return reject(error);
		});

	})
});

// insert data into data extension
app.get('/automation/create/query', async function (req, res){ 
	console.dir("Dump request body");
	console.dir(req.body);
	try {
		await addQueryActivity(req.body);
	} catch(err) {
		console.dir(err);
	}
	
});

const getIncrements = () => new Promise((resolve, reject) => {
	getOauth2Token().then((tokenResponse) => {

		axios.get(incrementsUrl, { 
			headers: { 
				Authorization: tokenResponse
			}
		})
		.then(response => {
			// If request is good...
			console.dir(response.data.items[0].values);
			return resolve(response.data.items[0].values);
		})
		.catch((error) => {
		    console.dir("Error getting increments");
		    return reject(error);
		});
	})
});

const saveToDataExtension = (targetUrl, payload, key, dataType, keyName) => new Promise((resolve, reject) => {

	console.dir("Target URL:");
	console.dir(targetUrl);
	console.dir("Payload:");
	console.dir(payload);
	console.dir("Key:");
	console.dir(key);
	console.dir("Type:");
	console.dir(dataType);
	console.dir("Key name:");
	console.dir(keyName);

	if ( dataType == "cpa" ) {

		var insertPayload = [{
	        "keys": {
	            [keyName]: (parseInt(key) + 1)
	        },
	        "values": payload
    	}];
		
		console.dir(insertPayload);

		getOauth2Token().then((tokenResponse) => {
		   	axios({
				method: 'post',
				url: targetUrl,
				headers: {'Authorization': tokenResponse},
				data: insertPayload
			})
			.then(function (response) {
				console.dir(response.data);
				return resolve(response.data);
			})
			.catch(function (error) {
				console.dir(error);
				return reject(error);
			});
		})	
	} 
});

const updateIncrements = (targetUrl, promotionObject, communicationCellObject, mcUniquePromotionObject, numberOfCodes) => new Promise((resolve, reject) => {

	console.dir("Target URL:");
	console.dir(targetUrl);

	console.dir("cpa Object Response:");
	console.dir(promotionObject[0].keys.promotion_key);

	console.dir("comm Object Response:");
	console.dir(communicationCellObject[1].keys.communication_cell_id);

	console.dir("pro desc Object Response:");
	console.dir(mcUniquePromotionObject[(parseInt(numberOfCodes) - 1)].keys.mc_unique_promotion_id);

	var mcInc = mcUniquePromotionObject[(parseInt(numberOfCodes) - 1)].keys.mc_unique_promotion_id;
	var updatedIncrementObject = {};
	updatedIncrementObject.mc_unique_promotion_id_increment = parseInt(mcInc) + 1;
	updatedIncrementObject.communication_cell_code_id_increment = parseInt(communicationCellObject[1].keys.communication_cell_id) + 1;
	updatedIncrementObject.promotion_key = parseInt(promotionObject[0].keys.promotion_key) + 1;

	console.dir(updatedIncrementObject);

	var insertPayload = [{
        "keys": {
            "increment_key": 1
        },
        "values": updatedIncrementObject
	}];
		
	console.dir(insertPayload);

	getOauth2Token().then((tokenResponse) => {
	   	axios({
			method: 'post',
			url: targetUrl,
			headers: {'Authorization': tokenResponse},
			data: insertPayload
		})
		.then(function (response) {
			console.dir(response.data);
			return resolve(response.data);
		})
		.catch(function (error) {
			console.dir(error);
			return reject(error);
		});
	})	
	
});

//Fetch increment values
app.get("/dataextension/lookup/increments", (req, res, next) => {

	getOauth2Token().then((tokenResponse) => {

		axios.get(incrementsUrl, { 
			headers: { 
				Authorization: tokenResponse
			}
		})
		.then(response => {
			// If request is good... 
			res.json(response.data);
		})
		.catch((error) => {
		    console.dir("Error getting increments");
		    console.dir(error);
		});
	})
});

//Fetch rows from control group data extension
app.get("/dataextension/lookup/controlgroups", (req, res, next) => {

	getOauth2Token().then((tokenResponse) => {

		axios.get(controlGroupsUrl, { 
			headers: { 
				Authorization: tokenResponse
			}
		})
		.then(response => {
			// If request is good... 
			res.json(response.data);
		})
		.catch((error) => {
		    console.dir("Error getting control groups");
		    console.dir(error);
		});
	})		

});

//Fetch rows from update contacts data extension
app.get("/dataextension/lookup/updatecontacts", (req, res, next) => {

	getOauth2Token().then((tokenResponse) => {

		axios.get(updateContactsUrl, { 
			headers: { 
				Authorization: tokenResponse
			}
		})
		.then(response => {
			// If request is good... 
			res.json(response.data);
		})
		.catch((error) => {
		    console.dir("Error getting update contacts");
		    console.dir(error);
		});
	})		

});

//Fetch rows from update contacts data extension
app.get("/dataextension/lookup/promotions", (req, res, next) => {

	getOauth2Token().then((tokenResponse) => {

		axios.get(promotionsUrl, { 
			headers: { 
				Authorization: tokenResponse
			}
		})
		.then(response => {
			// If request is good... 
			res.json(response.data);
		})
		.catch((error) => {
		    console.dir("Error getting update contacts");
		    console.dir(error);
		});
	})		

});


function buildAssociationPayload(payload, incrementData, numberOfCodes) {
	var campaignPromotionAssociationData = {};
	for ( var i = 0; i < payload.length; i++ ) {
		//console.dir("Step is: " + payload[i].step + ", Key is: " + payload[i].key + ", Value is: " + payload[i].value + ", Type is: " + payload[i].type);
		
		if ( campaignPromotionAssociationData[payload[i].key] == "email_template" ) {
			campaignPromotionAssociationData[payload[i].key] = payload[i].value;
		} else {
			campaignPromotionAssociationData[payload[i].key] = decodeURIComponent(payload[i].value);
		}
	}
	console.dir("building association payload")
	console.dir(campaignPromotionAssociationData);

	var mcUniqueIdForAssociation = incrementData.mc_unique_promotion_id_increment;
	var commCellForAssociation = incrementData.communication_cell_code_id_increment;

	console.dir("mc inc in desc build is:");
	console.dir(mcUniqueIdForAssociation);
	console.dir("comm cell inc in desc build is:");
	console.dir(commCellForAssociation);
	console.dir("no of codes:");
	console.dir(numberOfCodes);

	for ( var i = 1; i <= numberOfCodes; i++ ) {
		campaignPromotionAssociationData["mc_id_" + i] = parseInt(mcUniqueIdForAssociation) + i;
	}

	campaignPromotionAssociationData["communication_cell_id"] = parseInt(commCellForAssociation) + 1;
	campaignPromotionAssociationData["communication_cell_id_control"] = parseInt(commCellForAssociation) + 2;

	return campaignPromotionAssociationData;
}

// insert data into data extension
app.post('/dataextension/add/', async function (req, res){ 
	console.dir("Dump request body");
	console.dir(req.body);
	
});

app.post('/journeybuilder/save/', activity.save );
app.post('/journeybuilder/validate/', activity.validate );
app.post('/journeybuilder/publish/', activity.publish );
app.post('/journeybuilder/execute/', activity.execute );
app.post('/journeybuilder/stop/', activity.stop );
app.post('/journeybuilder/unpublish/', activity.unpublish );

// listening port
http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});