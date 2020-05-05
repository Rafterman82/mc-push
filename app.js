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
	  authUrl: 									process.env.authUrl,
	  clientId: 								process.env.clientId,
	  clientSecret: 							process.env.clientSecretSOAP,
	  clientIdSOAP: 							process.env.clientIdSOAP,
	  clientSecretSOAP: 						process.env.clientSecret,
	  SOAPUri: 									process.env.SOAPUri,
	  restUrl: 									process.env.restUrl,
	  appUrl: 									process.env.baseUrl,
	  promotionsListDataExtension: 				process.env.promotionsListDataExtension,
	  controlGroupsDataExtension: 				process.env.controlGroupsDataExtension,
	  updateContactsDataExtension: 				process.env.updateContactsDataExtension,
	  voucherPotsDataExtension: 				process.env.voucherPotsDataExtension,
	  insertDataExtension: 						process.env.insertDataExtension,
	  globalVoucherPot: 						process.env.globalVoucherPot,
	  promotionIncrementExtension:  			process.env.promotionIncrementExtension,
	  communicationCellDataExtension: 			process.env.communicationCellDataExtension,
	  promotionDescriptionDataExtension: 		process.env.promotionDescriptionDataExtension,
	  templateFilter: 							process.env.templateFilter 
	};
	console.dir(marketingCloud);
}

// url constants
const promotionsUrl 			= marketingCloud.restUrl + "data/v1/customobjectdata/key/" 	+ marketingCloud.promotionsListDataExtension 		+ "/rowset?$filter=ExecutedBy%20eq%20'TpAdmin'";
const globalCodesUrl 			= marketingCloud.restUrl + "data/v1/customobjectdata/key/" 	+ marketingCloud.globalVoucherPot 					+ "/rowset";
const controlGroupsUrl 			= marketingCloud.restUrl + "data/v1/customobjectdata/key/" 	+ marketingCloud.controlGroupsDataExtension 		+ "/rowset";
const updateContactsUrl 		= marketingCloud.restUrl + "data/v1/customobjectdata/key/" 	+ marketingCloud.updateContactsDataExtension 		+ "/rowset";
const voucherPotsUrl 			= marketingCloud.restUrl + "data/v1/customobjectdata/key/" 	+ marketingCloud.voucherPotsDataExtension 			+ "/rowset";


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

// configure FUEL SDK
var FuelSoap = require('fuel-soap');

const soapCreateQuery = () => new Promise((resolve, reject) => {

	getOauth2Token().then((tokenResponse) => {

		var options = {
			auth: {
				clientId: marketingCloud.clientIdSOAP, 
				clientSecret: marketingCloud.clientSecretSOAP,
				accessToken: tokenResponse
			}, 
			soapEndpoint: marketingCloud.SOAPUri // default --> https://webservice.exacttarget.com/Service.asmx
		};

		var SoapClient = new FuelSoap(options);

		var co = {
			"PartnerKey": true,
			"ObjectID":"8eed5631-9f42-e511-9915-8cdcd4aff7c9", // should be dynamic
		    "CustomerKey": "10a27c92-e45e-4a8b-8266-cff3c4ad0c39", // should be dynamic, however semantic name with date would work I guess
		    "Name": "Test SOAP Activity",
		    "Description": "This activity was created using SOAP",
		    "QueryText": "SELECT bucket.PARTY_ID, cpasit.MC_ID_1 as MC_UNIQUE_PROMOTION_ID, GETDATE() as ASSIGNMENT_DATETIME FROM NO_EMAIL_LOYALTY_TEST as bucket LEFT JOIN campaignPromotionAssociation_NEW_SIT as cpasit ON cpasit.MC_ID_1 = bucket.PROMOTION_KEY",
		    "TargetType": "DE",
		    "DataExtensionType": {
		    	"PartnerKey": true,
		    	"ObjectID": true,
		    	"CustomerKey": "AF58D55C-5CE1-4B8C-A065-F26259B1AC61",
		    	"Name": "PROMOTION_ASSIGNMENT_SIT"
		    },
		    "TargetUpdateType": "Overwrite"
		  };

		SoapClient.create('QueryDefinition',co, null, function(err, response){
		  if(err){
		    console.log(err);
		  }
		  else{
		    console.log(response.body.Results);
		  }
		});
	})	


});

// insert data into data extension
app.get('/automation/create/query', async function (req, res){ 
	console.dir("Dump request body");
	console.dir(req.body);
	try {
		await soapCreateQuery();
	} catch(err) {
		console.dir(err);
	}
	
});

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
	} else if ( dataType == "communication_cell") {
		var insertPayload = [{
	        "keys": {
	            [keyName]: (parseInt(key) + 1)
	        },
	        "values": payload.control,

    	},
    	{
	        "keys": {
	            [keyName]: (parseInt(key) + 2)
	        },
	        "values": payload.not_control,
	        
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
	} else if ( dataType == "promotion_description") {

		var insertPayload = [];

		for ( var i = 1; i <= Object.keys(payload.promotions).length; i++ ) {
			insertPayload.push({
		        "keys": {
		            [keyName]: (parseInt(key) + i)
		        },
		        "values": payload.promotions["promotion_" + i],

	    	});
		}
		console.dir("Promo desc data: ");
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

//Fetch rows from promotions data extension
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
		    console.dir("Error getting promotions");
		    console.dir(error);
		});
	})	
});

//Fetch rows from promotions data extension
app.get("/dataextension/lookup/globalcodes", (req, res, next) => {

	getOauth2Token().then((tokenResponse) => {

		axios.get(globalCodesUrl, { 
			headers: { 
				Authorization: tokenResponse
			}
		})
		.then(response => {
			// If request is good... 
			res.json(response.data);
		})
		.catch((error) => {
		    console.dir("Error getting global code");
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

//Fetch rows from voucher data extension
app.get("/dataextension/lookup/voucherpots", (req, res, next) => {

	getOauth2Token().then((tokenResponse) => {

		axios.get(voucherPotsUrl, { 
			headers: { 
				Authorization: tokenResponse
			}
		})
		.then(response => {
			// If request is good... 
			res.json(response.data);
		})
		.catch((error) => {
		    console.dir("Error getting voucher pots");
		    console.dir(error);
		});
	})		
});

//Fetch email templates
app.get("/dataextension/lookup/templates", (req, res, next) => {

	getOauth2Token().then((tokenResponse) => {

	   	axios({
			method: 'post',
			url: templatesUrl,
			headers: {'Authorization': tokenResponse},
			data: templatePayload
		})
		.then(function (response) {
			//console.dir(response.data);
			res.json(response.data);
		})
		.catch(function (error) {
			console.dir(error);
			return error;
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

function buildCommunicationCellPayload(payload) {
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
			},
			"control": {
		    	"cell_code"					: payload["cell_code"],
		    	"cell_name"					: payload["cell_name"],
		        "campaign_name"				: payload["campaign_name"],
		        "campaign_id"				: payload["campaign_id"],
		        "campaign_code"				: payload["campaign_code"],
		        "cell_type"					: "2",
		        "channel"					: "2",
		        "is_putput_flag"			: "0"				
			}
	};
	console.dir(communicationCellData);
	return communicationCellData;
}
function buildPromotionDescriptionPayload(payload, incrementData, numberOfCodes) {
	console.dir("payload is:");
	console.dir(payload);
	console.dir("increment payload");
	console.dir(incrementData);
	console.dir("number of codes: ");
	console.dir(numberOfCodes);

	var onlineTicker = 1;
	var instoreTicker = 1;
	var ticker = 1;
	var commCellForPromo = incrementData.communication_cell_code_id_increment;

	console.dir("comm cell id in desc build is:");
	console.dir(commCellForPromo)

	var promotionDescriptionData = {};
	
	promotionDescriptionData["promotions"] = {};

	for ( var i = 1; i <= numberOfCodes; i++ ) {
		var promotionArrayKey = "promotion_" + ticker;
		console.dir("Promo ticker is promotion_" + ticker);
		console.dir("I is " + i);

		if ( payload.promotionType == "online" || payload.promotionType == "online_instore" ) {

			console.dir("Promotion Type is " + payload.promotionType);
			console.dir("in online mode");
			if ( payload["global_code_" + onlineTicker] != "no-code" || payload["unique_code_" + onlineTicker] != "no-code" ) {
				console.dir("ADDING ONLINE DATA");
				promotionDescriptionData.promotions[promotionArrayKey] = {};
				promotionDescriptionData.promotions[promotionArrayKey]["offer_channel"] 		= "Online";
				promotionDescriptionData.promotions[promotionArrayKey]["offer_description"] 	= payload.campaign_name;
				promotionDescriptionData.promotions[promotionArrayKey]["ts_and_cs"] 			= "-";
				promotionDescriptionData.promotions[promotionArrayKey]["print_at_till_flag"] 	= payload.print_at_till_online;
				promotionDescriptionData.promotions[promotionArrayKey]["instant_win_flag"] 		= payload.instant_win_online;
				promotionDescriptionData.promotions[promotionArrayKey]["offer_medium"] 			= payload.offer_medium_online;
				promotionDescriptionData.promotions[promotionArrayKey]["communication_cell_id"] = parseInt(commCellForPromo) + 1;
				if ( payload.onlinePromotionType == "global" ) {
					promotionDescriptionData.promotions[promotionArrayKey]["barcode"] 				= payload["global_code_" + onlineTicker];
					promotionDescriptionData.promotions[promotionArrayKey]["promotion_id"] 			= payload["global_code_" + onlineTicker +"_promo_id"];
					promotionDescriptionData.promotions[promotionArrayKey]["promotion_group_id"] 	= payload["global_code_" + onlineTicker +"_promo_group_id"];
					promotionDescriptionData.promotions[promotionArrayKey]["valid_from_datetime"] 	= payload["global_code_" + onlineTicker +"_valid_from"];
					promotionDescriptionData.promotions[promotionArrayKey]["valid_to_datetime"] 	= payload["global_code_" + onlineTicker +"_valid_to"];
					promotionDescriptionData.promotions[promotionArrayKey]["visiblefrom"] 			= payload["global_code_" + onlineTicker +"_valid_from"];
					promotionDescriptionData.promotions[promotionArrayKey]["visibleto"] 			= payload["global_code_" + onlineTicker +"_valid_to"];
				} else if (payload.onlinePromotionType == "unique" ) {
					promotionDescriptionData.promotions[promotionArrayKey]["barcode"] 				= "-";
					promotionDescriptionData.promotions[promotionArrayKey]["promotion_id"] 			= payload["unique_code_" + onlineTicker +"_promo_id"];
					promotionDescriptionData.promotions[promotionArrayKey]["promotion_group_id"] 	= payload["unique_code_" + onlineTicker +"_promo_group_id"];
				}
				onlineTicker++;
				ticker++;
			}
		}
		if ( payload.promotionType == "instore" || payload.promotionType == "online_instore" ) {
			var promotionArrayKey = "promotion_" + ticker;
			console.dir("Promo ticker is promotion_" + ticker);
			console.dir("Promotion Type is " + payload.promotionType);
			console.dir("In instore mode");
			if ( payload["instore_code_" + instoreTicker] != "no-code" ) {
				console.dir("ADDING INSTORE DATA");
				promotionDescriptionData.promotions[promotionArrayKey] = {};
				promotionDescriptionData.promotions[promotionArrayKey]["offer_channel"] 				= "Instore";
				promotionDescriptionData.promotions[promotionArrayKey]["offer_description"] 			= payload.campaign_name;
				promotionDescriptionData.promotions[promotionArrayKey]["ts_and_cs"] 					= "-";
				promotionDescriptionData.promotions[promotionArrayKey]["barcode"] 						= payload["instore_code_" + instoreTicker];
				promotionDescriptionData.promotions[promotionArrayKey]["promotion_id"]					= payload["instore_code_" + instoreTicker +"_promo_id"];
				promotionDescriptionData.promotions[promotionArrayKey]["promotion_group_id"]			= payload["instore_code_" + instoreTicker +"_promo_group_id"];
				promotionDescriptionData.promotions[promotionArrayKey]["valid_from_datetime"] 			= payload["instore_code_" + instoreTicker +"_valid_from"];
				promotionDescriptionData.promotions[promotionArrayKey]["valid_to_datetime"] 			= payload["instore_code_" + instoreTicker +"_valid_to"];
				promotionDescriptionData.promotions[promotionArrayKey]["visiblefrom"]					= payload["instore_code_" + instoreTicker +"_valid_from"];
				promotionDescriptionData.promotions[promotionArrayKey]["visibleto"] 					= payload["instore_code_" + instoreTicker +"_valid_to"];
				promotionDescriptionData.promotions[promotionArrayKey]["number_of_redemptions_allowed"] = payload["instore_code_" + instoreTicker +"_redemptions"];
				promotionDescriptionData.promotions[promotionArrayKey]["print_at_till_flag"] 			= payload.print_at_till_instore;
				promotionDescriptionData.promotions[promotionArrayKey]["instant_win_flag"] 				= payload.instant_win_instore;
				promotionDescriptionData.promotions[promotionArrayKey]["offer_medium"] 					= payload.offer_medium_instore;
				promotionDescriptionData.promotions[promotionArrayKey]["communication_cell_id"] 		= parseInt(commCellForPromo) + 1;
				instoreTicker++;
				ticker++;
			}
		}
	}

	console.dir(promotionDescriptionData);

	return promotionDescriptionData;
}

function countCodes(payload) {

	var cpaData = {};
	for ( var i = 0; i < payload.length; i++ ) {
		//console.dir("Step is: " + payload[i].step + ", Key is: " + payload[i].key + ", Value is: " + payload[i].value + ", Type is: " + payload[i].type);
		cpaData[payload[i].key] = payload[i].value;
	}

	console.dir("payload passed to count");
	console.dir(cpaData);

	console.dir("get code as example");
	console.dir(cpaData.global_code_1);

	console.dir("get code as example dynamically");
	console.dir(cpaData["global_code_1"]);

	var globalCodes = 0;
	var uniqueCodes = 0;
	var instoreCodes = 0;
	var totalCodes = 0;

	for ( var i = 1; i <= 5; i++) {
		if ( cpaData["global_code_" + i] != "no-code" ) {
			globalCodes++;
		}
	}
	for ( var i = 1; i <= 5; i++) {
		if ( cpaData["unique_code_" + i] != "no-code" ) {
			uniqueCodes++;
		}
	}
	for ( var i = 1; i <= 5; i++) {
		if ( cpaData["instore_code_" + i] != "no-code" ) {
			instoreCodes++;
		}
	}
	console.dir("num of codes:");
	console.dir(parseInt(globalCodes) + parseInt(uniqueCodes) + parseInt(instoreCodes));
	return parseInt(globalCodes) + parseInt(uniqueCodes) + parseInt(instoreCodes);
}

async function buildAndSend(payload) {
	try {
		const numberOfCodes = await countCodes(payload);
		const incrementData = await getIncrements();
		const associationPayload = await buildAssociationPayload(payload, incrementData, numberOfCodes);
		const communicationCellPayload = await buildCommunicationCellPayload(associationPayload);
		const promotionDescriptionPayload = await buildPromotionDescriptionPayload(associationPayload, incrementData, numberOfCodes);
		const promotionObject = await saveToDataExtension(campaignAssociationUrl, associationPayload, incrementData.promotion_key, "cpa", "promotion_key");
		const communicationCellObject = await saveToDataExtension(communicationCellUrl, communicationCellPayload, incrementData.communication_cell_code_id_increment, "communication_cell", "communication_cell_id");
		const mcUniquePromotionObject = await saveToDataExtension(descriptionUrl, promotionDescriptionPayload, incrementData.mc_unique_promotion_id_increment, "promotion_description", "mc_unique_promotion_id");
		await updateIncrements(updateIncrementsUrl, promotionObject, communicationCellObject, mcUniquePromotionObject, numberOfCodes);
		return associationPayload;
	} catch(err) {
		console.dir(err);
	}
}

async function sendBackPayload(payload) {
	try {
		await buildAndSend(payload);
		const getIncrementsForSendback = await getIncrements();
		var sendBackPromotionKey = parseInt(getIncrementsForSendback.promotion_key) + 1;
		return sendBackPromotionKey
	} catch(err) {
		console.dir(err);
	}

}
// insert data into data extension
app.post('/dataextension/add/', async function (req, res){ 
	console.dir("Dump request body");
	console.dir(req.body);
	try {
		const nextKey = await sendBackPayload(req.body)
		res.send(JSON.stringify(nextKey));
	} catch(err) {
		console.dir(err);
	}
	
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