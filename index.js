'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()

app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

//Setup
// App Secret can be retrieved from the App Dashboard

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = process.env.VALIDATION_TOKEN

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN


// Index route
app.get('/', function (req, res) {
  res.send('Hi!')
})

// for Facebook verification
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }  
});

app.post('/webhook', function (req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object === 'page') {

    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;

      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        if (event.message) {
          console.log("1 Normal message");
          receivedMessage(event);
        }else if(event.postback){
          console.log("1 Postback");
          receivedPostback(event);
        } else {
          console.log("Webhook received unknown event: ", event);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    res.sendStatus(200);
  }
});
  
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;

  var messageText = message.text;
  var messageAttachments = message.attachments;

  if (messageText) {
    sendOptionsMessage(senderID);
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}

function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var payload = event.postback.payload;

  console.log("SenderID : " + senderID);

  console.log("Postback : "+payload);
  switch (payload) {
      case 'GET_STARTED_PAYLOAD':
        sendOptionsMessage(senderID);
        break;
      case 'VER_PAGOS_PENDIENTES':
          sendPayActionMessage(senderID);
        break;
      case 'VER_HISTORICO_PAGOS' : 
          sendTextMessage(senderID , 'Paid : May  : 10,89$ \n Paid : June : 11,29$ \n Paid : July : 12,59$');
          break;
      default:
        sendTextMessage(senderID, payload);
    }

}

function sendOptionsMessage(recipientId) {
  var messageData = {
    recipient : {
      id: recipientId
    },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text:'What would you like to do?',
          buttons: [{
            type:'postback',
            title:'See pending bills',
            payload:'VER_PAGOS_PENDIENTES'
          },
          {
            type:'postback',
            title:'Show me history',
            payload:'VER_HISTORICO_PAGOS'
          }]
        }
      }
    }
  };  

  callSendAPI(recipientId, messageData);

}

function sendPayActionMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements :[
           {
              title: "rift",
              subtitle: "Next-generation virtual reality",
              image_url: "http://messengerdemo.parseapp.com/img/rift.png",
              buttons: [{
                type:'payment',
                title:'buy',
                payload:'PAGAR_CAFE',
                payment_summary:{
                    currency:'USD',
                    payment_type:'FIXED_AMOUNT',
                    is_test_payment : true, 
                    merchant_name:'Peters Apparel',
                    requested_user_info:[
                      'shipping_address',
                      'contact_name',
                      'contact_phone',
                      'contact_email'
                    ],
                    price_list:[
                      {
                        label:'Subtotal',
                        amount:'29.99'
                      },
                      {
                        label:'Taxes',
                        amount:'2.47'
                      }
                    ]
                  }
            }]
          }
          ]
        }
      }
    }
  };  


  callSendAPI(recipientId, messageData);

}

function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };
  callSendAPI(recipientId, messageData);
}

function callSendAPI(recipientId , messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s", 
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
      console.error(response.statusCode);
      sendTextMessage('1512754418744813' , '😵 Sorry, this option only works on USA at the moment');
    }
  });  
}

// Spin up the server
app.listen(app.get('port'), function() {
  console.log('running on port', app.get('port'))
})



