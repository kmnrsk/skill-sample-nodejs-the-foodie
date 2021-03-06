/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk');
const Moment = require('moment-timezone');

// Update 2018/9/10 - If you see any module errors such as:
// 
// serviceClientFactory.getUpsServiceClient is not a function
// 
// try deleting the modules in your node_modules folder and run `npm install` again.

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {

    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes();

    const speechText = getWelcomeMessage(sessionAttributes)
      + " " 
      + getPrompt(sessionAttributes);

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withAskForPermissionsConsentCard(permissions)
      .getResponse();
  },
};

const LaunchRequestWithConsentTokenHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === "LaunchRequest"
      && handlerInput.requestEnvelope.context.System.user.permissions
      && handlerInput.requestEnvelope.context.System.user.permissions.consentToken;
  },
  async handle(handlerInput) {
    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes();

    const speechText = getWelcomeMessage(sessionAttributes)
      + " " 
      + getPrompt(sessionAttributes);
      
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  }
};



const SIPRecommendationIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'RecommendationIntent'
      && handlerInput.requestEnvelope.request.dialogState !== 'COMPLETED';
  },
  handle(handlerInput) {
    
    let currentIntent = handlerInput.requestEnvelope.request.intent;
    const { responseBuilder } = handlerInput;
    const result = disambiguateSlot(getSlotValues(currentIntent.slots));
    
    console.log('disambiguateSlot:', JSON.stringify(result));

    if (result) {
      responseBuilder
        .speak(result.prompt)
        .reprompt(result.prompt)
        .addElicitSlotDirective(result.slotName, currentIntent);
    } else {
      responseBuilder.addDelegateDirective(currentIntent);
    }

    console.log('RESPONSE:', JSON.stringify(responseBuilder.getResponse()));
    return responseBuilder
      .getResponse();
  }
};

// const CustomerProvidedMealRecommendationIntentHandler = {
//   canHandle(handlerInput) {
//     return handlerInput.requestEnvelope.request.type === "IntentRequest"
//       && handlerInput.requestEnvelope.request.intent.name === "RecommendationIntent"
//       && handlerInput.requestEnvelope.request.intent.slots.meal.value;
//   },
//   handle(handlerInput) {

//   }
// };

const SuggestMealRecommendationIntentHandler = {
  canHandle(handlerInput) {

    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes();

    const slots = ["timeOfDay", "cuisine", "allergies", "diet"];
    
    console.log('SuggestMealRecommendationIntent - meals:', sessionAttributes.recommendations.current.meals.length);
    console.log('SuggestMealRecommendationIntent - meals:', JSON.stringify(sessionAttributes.recommendations.current.meals));

    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'RecommendationIntent'
      && !handlerInput.requestEnvelope.request.intent.slots.meal.value 
      && intentSlotsHaveBeenFilled(handlerInput.requestEnvelope.request.intent, slots) 
      && !intentSlotsNeedDisambiguation(handlerInput.requestEnvelope.request.intent, slots);
  },
  handle(handlerInput) {
    console.log('SuggestMealRecommendationIntent:', handlerInput.requestEnvelope.request);

    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes();
    const currentIntent = handlerInput.requestEnvelope.request.intent;

    // TODO: Do the look up here!

    sessionAttributes.recommendations.current.meals = ["トムヤムクン", "カレー", "チゲ鍋"];
    attributesManager.setSessionAttributes(sessionAttributes);

    console.log('currentIntent.slots:', JSON.stringify(currentIntent.slots));

    return handlerInput.responseBuilder
    .speak("それならおすすめの食事が三つありますよ？　トムヤンクン、カレー、チゲ鍋です。どれにしますか？")
    .reprompt('トムヤムクン、カレー、チゲ鍋、どれにしますか？')
     .addElicitSlotDirective('meal', currentIntent)
     .getResponse();
  }
};

// TODO: handler for meals containing ingredients that conflict with their allergies and diet.

// TODO: remove this since we no longer need it.
const promptForDeliveryOption = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'RecommendationIntent'
      && handlerInput.requestEnvelope.request.intent.slots.meal.value
      && !handlerInput.requestEnvelope.request.intent.slots.deliveryOption.value;
  },
  handle(handlerInput) {
    
    return handlerInput.responseBuilder
      .speak('どこで食べますか？外食？お持ち帰りにする？それとも自分で作りますか？')
      .reprompt('外食？お持ち帰り？それとも自分で作る？')
      .addElicitSlotDirective('deliveryOption')
      .getResponse();

  }
};

const CRecommendationIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === "IntentRequest"
      && handlerInput.requestEnvelope.request.intent.name === "RecommendationIntent"
      && handlerInput.requestEnvelope.request.dialogState === "COMPLETED";
  },
  handle(handlerInput) {
    console.log("COMPLETED RecommendationIntent");

    const currentIntent = handlerInput.requestEnvelope.request.intent;
    const slotValues = getSlotValues(currentIntent.slots);

    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes();

    //sessionAttributes.recommendations.previous = slotValues.meal.synonym;
    sessionAttributes.recommendations.previous.meal = slotValues.meal.synonym;
    sessionAttributes[currentIntent.name] = undefined;

    console.log("deleting slot data for:", currentIntent.name);
    console.log("after delete:", JSON.stringify(sessionAttributes));

    attributesManager.setSessionAttributes(sessionAttributes);

    let speechText = "";

    // TODO: split this into different completed handlers
    if (slotValues.deliveryOption.statusCode === "ER_SUCCESS_MATCH") {
      
      if (slotValues.deliveryOption.resolvedValues[0] !== "作る") {
        const address = sessionAttributes.profile.location.address;
        if (address.zip || address.city && address.state) {
          // TODO: look up where the restaurants would be
          console.log("look up the restaurants");
          speechText = "<say-as interpret-as='interjection'>オッケー</say-as>！<break time='1s'/>近くに二件あります。マイタイ、アヒリエです。どちらにします？";

        } else {
          console.log("We need to elicit for address");
          speechText = "近くのレストランを探します。現在地を教えてください。"
        }
      } else {
        // TODO prompt for portion
        speechText = "食事の量は、多め、普通、少なめ、のどれですか？";
      }
    } else {
        // TODO: validate input for options - if we don't know ER_SUCCESS_NO_MATCH ask again
        speechText = "どこで食べますか？外食？お持ち帰り？それとも自分で作りますか？";
        return handlerInput.responseBuilder
          .addElicitSlotDirective("deliveryOption")
          .speak(speechText)
          .reprompt(speechText)
          .getResponse();
    }

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  },
};

// TODO: remove this
// const GetMealIntentHandler = {
//   canHandle(handlerInput) {
//     return handlerInput.requestEnvelope.request.type === "IntentRequest"
//       && handlerInput.requestEnvelope.request.intent.name === "GetMealIntent";
//   },
//   handle(handlerInput) {
//     return handlerInput.responseBuilder
//       .speak("Hello there")
//       .getResponse();
//   }
// };

// TODO: remove this
const LookupRestaurantIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === "IntentRequest"
      && handlerInput.requestEnvelope.request.intent.name === "LookupRestaurantIntent";
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("マイタイの住所をアレクサアプリに送りました。<break time='1s'/><say-as interpret-as='interjection'>お役に立てればうれしいです</say-as>")
      .getResponse();
  }
};

const InProgressCaptureAddressIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === "IntentRequest"
      && handlerInput.requestEnvelope.request.intent.name === "CaptureAddressIntent"
      && handlerInput.requestEnvelope.request.dialogState !== "COMPLETED";
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .addDelegateDirective()
      .getResponse();
  }
};

const InProgressHasZipCaptureAddressIntentHandler = {
  canHandle(handlerInput) {
    const currentIntent = handlerInput.requestEnvelope.request.intent;
    return handlerInput.requestEnvelope.request.type === "IntentRequest"
      && currentIntent.name === "CaptureAddressIntent"
      && intentSlotsHaveBeenFilled(currentIntent, ["zip"])
      && handlerInput.requestEnvelope.request.dialogState !== "COMPLETED";
  },
  handle(handlerInput) {
    const currentIntent = handlerInput.requestEnvelope.request.intent;
    const slotValues = getSlotValues(currentIntent.slots);

    let speechText = slotValues.zip.synonym + "の近くに二件見つかりました。";
    speechText +=  "マイタイ、アヒリエです。どちらにしますか？";
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  }
};

const InProgressHasCityStateCaptureAddressIntentHandler = {
  canHandle(handlerInput) {
    const currentIntent = handlerInput.requestEnvelope.request.intent;
    return handlerInput.requestEnvelope.request.type === "IntentRequest"
      && currentIntent.name === "CaptureAddressIntent"
      && intentSlotsHaveBeenFilled(currentIntent, ["city", "state"])
      && handlerInput.requestEnvelope.request.dialogState !== "COMPLETED";
  },
  handle(handlerInput) {
    const currentIntent = handlerInput.requestEnvelope.request.intent;
    const slotValues = getSlotValues(currentIntent.slots);
    
    let speechText = slotValues.state.synonym + slotValues.city.synonym + "の近くに二件見つかりました。"
    speechText +=  "マイタイ、アヒリエです。どちらにしますか？";

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  }
};


const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speechText = 'お食事ガイドです。あなたのお食事選びのお手伝いをします。はじめるには「お腹がすいた」、と言ってください。どうぞ！';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard('お食事ガイド', speechText)
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    const speechText = '<say-as interpret-as="interjection">またいつでもどうぞ</say-as>';

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('お食事ガイド', speechText)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);
    console.log(error.stack);

    return handlerInput.responseBuilder
      .speak('<say-as interpret-as="interjection">すみません</say-as>。ちょっとよくわかりませんでした。もう一度言ってください。')
      .reprompt('<say-as interpret-as="interjection">すみません</say-as>。ちょっとよくわかりませんでした。もう一度言ってください。')
      .getResponse();
  },
};

/* RESPONSE INTERCEPTORS */

// This interceptor loads our profile from persistent storage into the session
// attributes.
const NewSessionRequestInterceptor = {
  async process(handlerInput) {
    console.log("NewSessionRequestInterceptor is processing");
    console.log('request:', JSON.stringify(handlerInput.requestEnvelope.request));

    if (handlerInput.requestEnvelope.session.new) {
      const attributesManager = handlerInput.attributesManager;
      let sessionAttributes = attributesManager.getSessionAttributes();

      const persistentAttributes = await attributesManager.getPersistentAttributes();
      
      console.log('persistentAttributes:', JSON.stringify(persistentAttributes));

      if (!persistentAttributes.profile) {
        console.log('Initializing new profile...');
        sessionAttributes.isNew = true;
        sessionAttributes.profile = initializeProfile();
        sessionAttributes.recommendations = initializeRecommendations();
      } else {
        console.log('Restoring profile from persistent store.');
        sessionAttributes.isNew = false;
        sessionAttributes = persistentAttributes;
      }
      
      console.log("set sessionAttributes to:",JSON.stringify(sessionAttributes));
      attributesManager.setSessionAttributes(sessionAttributes);
    }
  }
};

const SetTimeOfDayInterceptor = {
  async process(handlerInput) {
    console.log("SetTimeOfDayInterceptor is processing");
    const { requestEnvelope, serviceClientFactory, attributesManager } = handlerInput;
    const sessionAttributes = attributesManager.getSessionAttributes();

    // look up the time of day if we don't know it already.
    if (!sessionAttributes.timeOfDay) {
      const deviceId = requestEnvelope.context.System.device.deviceId;

      const upsServiceClient = serviceClientFactory.getUpsServiceClient();
      const timezone = await upsServiceClient.getSystemTimeZone(deviceId);

      const currentTime = getCurrentTime(timezone);
      const timeOfDay = getTimeOfDay(currentTime);

      sessionAttributes.timeOfDay = timeOfDay;
      sessionAttributes.profile.location.timezone = timezone;
      attributesManager.setSessionAttributes(sessionAttributes);
      
      console.log("SetTimeOfDayInterceptor - currentTime:", currentTime);
      console.log("SetTimeOfDayInterceptor - timezone:", timezone);
      console.log('SetTimeOfDayInterceptor - time of day:', timeOfDay);
      console.log('SetTimeOfDayInterceptor - sessionAttributes', JSON.stringify(sessionAttributes));
    }
  }
};

const HasConsentTokenRequestInterceptor = {
  async process(handlerInput) {
    const { requestEnvelope, serviceClientFactory, attributesManager } = handlerInput;
    const sessionAttributes = attributesManager.getSessionAttributes();

    if (handlerInput.requestEnvelope.context.System.user.permissions
        && handlerInput.requestEnvelope.context.System.user.permissions.consentToken
        && (!sessionAttributes.profile.location.address.city
        || !sessionAttributes.profile.location.address.state
        || !sessionAttributes.profile.location.address.zip)) {

      const { deviceId } = requestEnvelope.context.System.device;
      const deviceAddressServiceClient = serviceClientFactory.getDeviceAddressServiceClient();
      const address = await deviceAddressServiceClient.getFullAddress(deviceId);

      console.log(JSON.stringify(address));
  
      if (address.postalCode) {
        sessionAttributes.profile.location.address.zip = address.postalCode;
      } else if (address.city && address.stateOrRegion) {
        sessionAttributes.profile.location.address.city = address.city;
        sessionAttributes.profile.location.address.state = address.stateOrRegion;
      }

      attributesManager.setSessionAttributes(sessionAttributes);
      console.log('HasConsentTokenRequestInterceptor - sessionAttributes', JSON.stringify(sessionAttributes)); 
    }
  }
};

// This interceptor initializes our slots with the values from the user profile.
const RecommendationIntentStartedRequestInterceptor = {
  process(handlerInput) {
    if (handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'RecommendationIntent'
      && handlerInput.requestEnvelope.request.dialogState === "STARTED") {
        console.log("recommendationIntentStartedRequestInterceptor:", "Initialize the session attributes for the intent.");

        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes();
        const profile = sessionAttributes.profile;
        
        // handlerInput is passed by reference so any modification we make in 
        // our interceptor will be present in our intent handler's canHandle and
        // handle function
        const updatedIntent = handlerInput.requestEnvelope.request.intent;

        updatedIntent.slots.name.value = profile.name || undefined;
        updatedIntent.slots.diet.value = profile.diet || undefined;
        updatedIntent.slots.allergies.value = profile.allergies || undefined;

        updatedIntent.slots.timeOfDay.value = sessionAttributes.timeOfDay || undefined;

        console.log(JSON.stringify(updatedIntent));
      }
  }
};

// This interceptor looks at the slots belonging to the request.
// If allergies or diet have been provided, it will store them in the user 
// profile stored in the session attributes. When the skill closes, this 
// information will be saved.
const RecommendationIntentCaptureSlotToProfileInterceptor = {
  process(handlerInput) {
    const intentName = "RecommendationIntent";
    const slots = [ "allergies", "diet"];
    console.log('recommendationIntentCaptureSlotToProfileInterceptor');
    saveNewlyFilledSlotsToSessionAttributes(handlerInput, intentName, slots, (sessionAttributes, slotName, newlyFilledSlot) => {
      sessionAttributes.profile[slotName] = newlyFilledSlot.synonym;
    });
  }
};

// This interceptor looks at the slots belonging to the request.
// If zip, city or state have been provided, it will store them in the user 
// location attributes. When the skill closes, this information will be saved.
const CaptureAddressIntentCaptureSlotsToProfileInterceptor = {
  process(handlerInput) {
    const intentName = "CaptureAddressIntent";
    const slots = ["zip", "state", "city"];
    console.log('CaptureAddressIntentCaptureSlotsToProfileInterceptor call saveNewlyFilledSlotsToSessionAttributes');
    saveNewlyFilledSlotsToSessionAttributes(handlerInput, intentName, slots, (sessionAttributes, slotName, newlyFilledSlot) => {
      sessionAttributes.profile.location.address[slotName] = newlyFilledSlot.synonym;
    });
  }
};


// given an intent name and a set of slots, saveNewlyFilledSlotsToSessionAttributes 
// will save newly filled values of the given slots into the session attributes.
// The callback allows you to set the slot value into session attributes however
// you want.
function saveNewlyFilledSlotsToSessionAttributes(handlerInput, intentName, slots, callback) {
  const attributesManager = handlerInput.attributesManager;
  const sessionAttributes = attributesManager.getSessionAttributes();
  const currentIntent = handlerInput.requestEnvelope.request.intent;

  if (handlerInput.requestEnvelope.request.type === "IntentRequest"
    && currentIntent.name === intentName) {
    
    const previousIntent = sessionAttributes[currentIntent.name];
    console.log('CALL intentHasNewlyFilledSlots IN saveNewlyFilledSlotsToSessionAttributes ');
    const newlyFilledSlots = intentHasNewlyFilledSlots(previousIntent, currentIntent, slots);
    console.log('saveNewlyFilledSlotsToSessionAttributes');

    // We only save if the slot(s) has been filled with something new.
    if (newlyFilledSlots.found) {
      for (let slotName in newlyFilledSlots.slots) {
        console.log('inserting:', 
        slotName, JSON.stringify(newlyFilledSlots.slots[slotName]), 
        JSON.stringify(sessionAttributes));
        callback(sessionAttributes, slotName, newlyFilledSlots.slots[slotName]);
      }
      attributesManager.setSessionAttributes(sessionAttributes);
    }
  }  
}

// This interceptor handles intent switching during dialog management by
// syncing the previously collected slots stored in the session attributes
// with the current intent. The slots currently collected take precedence so
// the user is able to overidde previously collected slots.
const DialogManagementStateInterceptor = {
  process(handlerInput) {
    const currentIntent = handlerInput.requestEnvelope.request.intent;

    if (handlerInput.requestEnvelope.request.type === "IntentRequest"
      && handlerInput.requestEnvelope.request.dialogState !== "COMPLETED") {

      const attributesManager = handlerInput.attributesManager;
      const sessionAttributes = attributesManager.getSessionAttributes();

      // If there are no session attributes we've never entered dialog management
      // for this intent before.
      if (sessionAttributes[currentIntent.name]) {
        let currentIntentSlots = sessionAttributes[currentIntent.name].slots;
        for (let key in currentIntentSlots) {

          // we let the current intent's values override the session attributes
          // that way the user can override previously given values.
          // this includes anything we have previously stored in their profile.
          if (currentIntentSlots[key].value && !currentIntent.slots[key].value) {
            currentIntent.slots[key] = currentIntentSlots[key];
          }
        }    
      }

      sessionAttributes[currentIntent.name] = currentIntent;
      attributesManager.setSessionAttributes(sessionAttributes);
    }
  }
};

/* Response INTERCEPTORS */

// This Response interceptor detects if the skill is going to exit and saves the
// session attributes into the persistent store.
const SessionWillEndInterceptor = {
  async process(handlerInput, responseOutput) {

    // let shouldEndSession = responseOutput.shouldEndSession;
    // shouldEndSession = (typeof shouldEndSession == "undefined" ? true : shouldEndSession);
    const requestType = handlerInput.requestEnvelope.request.type;

    const ses = (typeof responseOutput.shouldEndSession == "undefined" ? true : responseOutput.shouldEndSession);

    console.log('responseOutput:', JSON.stringify(responseOutput));

    if(ses && !responseOutput.directives || requestType === 'SessionEndedRequest') {

    // if(shouldEndSession || requestType == 'SessionEndedRequest') {
      console.log('SessionWillEndInterceptor', 'end!');
      const attributesManager = handlerInput.attributesManager;
      const sessionAttributes = attributesManager.getSessionAttributes();
      const persistentAttributes = await attributesManager.getPersistentAttributes();
      
      persistentAttributes.profile = sessionAttributes.profile;
      persistentAttributes.recommendations = sessionAttributes.recommendations;
      persistentAttributes.recommendations.current.meals = [];

      console.log(JSON.stringify(sessionAttributes));

      attributesManager.setPersistentAttributes(persistentAttributes);
      attributesManager.savePersistentAttributes(persistentAttributes);
    }
  }
};

/* CONSTANTS */

const permissions = ['read::alexa:device:all:address'];

const requiredSlots = {
  allergies: true,
  meal: true,
  cuisine: true,
  diet: true,
  deliveryOption: true,
  timeOfDay: true
};

/* HELPER FUNCTIONS */

function initializeProfile() {
  return {
    name: "",
    allergies: "",
    diet: "",
    location: {
        address: {
            city: "",
            state: "",
            zip: ""
        },
        timezone: ""
    }
  };
}

function initializeRecommendations() {
  return {
    previous: {
        meal: "",
        restaurant: ""
    },
    current: {
        meals: [],
        restaurants: []
    }
  };
}

// gets the welcome message based upon the context of the skill.
function getWelcomeMessage(sessionAttributes) {

  let speechText = "";

  if (sessionAttributes.isNew) {
    speechText += "お食事ガイドへようこそ。";
    speechText += "あなたのお食事選びのお手伝いをしますよ？";
    speechText += "さっそく始めましょう。<break time='1s'/>";
    speechText += "近くのお店を探すために、アレクサアプリで所在地情報へのアクセスを許可してくださいね？";
    speechText += "この操作は一回だけです。";

  } else {
    speechText += "お帰りなさい。";

    const timeOfDay = sessionAttributes.timeOfDay;
    if (timeOfDay) {
      speechText += getTimeOfDayMessage(timeOfDay);
    } else {
      speechText += "さぁ、楽しいお食事にしましょう。";
    }
    
    if (sessionAttributes.recommendations.previous.meal) {
      speechText += "前回は、" + sessionAttributes.recommendations.previous.meal + "だったようですね？";
      speechText += "今日は、";
    }
    
  }
  return speechText;
}

function getTimeOfDayMessage(timeOfDay) {
  const messages = timeOfDayMessages[timeOfDay];
  console.log(JSON.stringify(messages));
  return randomPhrase(messages);
  
}

function randomPhrase(phraseList) {
  console.log(JSON.stringify(phraseList));
  let i = Math.floor(Math.random() * phraseList.length);
  return(phraseList[i]);
}

const timeOfDayMessages = {
  breakfast: [
    '朝食の時間ですね？',
    '<say-as interpret-as="interjection">おはようございます</say-as>。朝ごはんの時間ですね？',
    '<say-as interpret-as="interjection">おはよう</say-as>。朝ごはんですよー。',
    '<audio src="https://s3.amazonaws.com/ask-soundlibrary/animals/amzn_sfx_rooster_crow_01.mp3"/><say-as interpret-as="interjection">おはよう</say-as>。朝ですよー。'
  ],
  brunch: [
    '<say-as interpret-as="interjection">おはよう</say-as>。ブランチにしましょう。',
    '<audio src="https://s3.amazonaws.com/ask-soundlibrary/animals/amzn_sfx_rooster_crow_02.mp3"/>プランチにしましょう。'
  ],
  lunch: [
    'ランチタイムですね？',
    'お昼の時間ですね？',
    'ランチの時間ですね？'
  ],
  dinner: [
    '夕食の時間ですね？',
    '晩御飯の時間ですね？',
    'ディナーの時間ですね？',
    'さぁ、楽しい夕食の時間ですよ!'
  ],
  midnight: [
    '<say-as interpret-as="interjection">あらら</say-as>、夜更かししてますね。少しお腹がすきましたか？',
    'お夜食の時間です？'
  ]
};

// gets the prompt based upon the context of the skill.
function getPrompt(sessionAttributes) {

  //let speechText =  "For now, what time of day is it?";
  let speechText =  "今は、どの食事の時間帯ですか？";
  if (!sessionAttributes.isNew) {
    //speechText = "Let's narrow it down. What flavors do you feel like? You can say things like spicy, savory, greasy, and fresh.";
    speechText = 'どんなものが食べたい気分ですか？ からい、こってり、さっぱり など、食べたいものの味を言ってみてください。'
  }

  return speechText;
}

// given the slots object from the JSON Request to the skill, builds a simplified
// object which simplifies inpecting slots for entity resultion matches.
function getSlotValues(slots) {

  const slotValues = {};

  for (let key in slots) {

      if (slots.hasOwnProperty(key)) {

          slotValues[key] = {
              synonym: slots[key].value || null ,
              resolvedValues: (slots[key].value ? [slots[key].value] : []),
              statusCode: null,
          };
          
          let statusCode = (((((slots[key] || {} )
              .resolutions || {})
              .resolutionsPerAuthority || [])[0] || {} )
              .status || {})
              .code;

          let authority = ((((slots[key] || {})
              .resolutions || {})
              .resolutionsPerAuthority || [])[0] || {})
              .authority;

          slotValues[key].authority = authority;
          
          // any value other than undefined then entity resolution was successful
          if (statusCode) {
              slotValues[key].statusCode = statusCode;
              
              // we have resolved value(s)!
              if (slots[key].resolutions.resolutionsPerAuthority[0].values) {
                  let resolvedValues = slots[key].resolutions.resolutionsPerAuthority[0].values;
                  slotValues[key].resolvedValues = [];
                  for (let i = 0; i < resolvedValues.length; i++) {                   
                      slotValues[key].resolvedValues.push({
                          value: resolvedValues[i].value.name,
                          id: resolvedValues[i].value.id 
                      });
                  }
              }
          }
      }
  }
  return slotValues;
}

function getNewSlots(previous, current) {
  const previousSlotValues = getSlotValues(previous);
  const currentSlotValues = getSlotValues(current);

  let newlyCollectedSlots = {};
  for(let slotName in previousSlotValues) {
      // resolvedValues and statusCode are dependent on our synonym so we only
      // need to check if there's a difference of synonyms.
      if (previousSlotValues[slotName].synonym !== currentSlotValues[slotName].synonym){
          newlyCollectedSlots[slotName] = currentSlotValues[slotName];
      }
  }
  return newlyCollectedSlots;
}

// intentHasNewlyFilledSlots given a previous and current intent and a set of 
// slots, this function will compare the previous intent's slots with current 
// intent's slots to determine what's new. The results are filtered by the 
// provided array of "slots". For example if you wanted to determine if there's
// a new value for the "state" and "city" slot you would pass the previous and
// current intent and an array containing both strings. If previous is undefined,
// all filled slots are treated as newly filled. 
// Returns: 
// {
//   found: (true | false)
//   slots: object of slots returned from getSlots
// }
function intentHasNewlyFilledSlots(previous, intent, slots) {

  let newSlots;
  // if we don't have a previous intent then all non-empty intent's slots are 
  // newly filled!
  if (!previous) {
    const slotValues = getSlotValues(intent.slots);
    newSlots = {};
    for (let slotName in slotValues) {
      if (slotValues[slotName].synonym) {
        newSlots[slotName] = slotValues[slotName];
      }
    }
  } else {
    newSlots = getNewSlots(previous.slots, intent.slots);
  }

  const results = {
    found: false,
    slots: {}
  };
  
  slots.forEach(slot => {
    if(newSlots[slot]) {
      results.slots[slot] = newSlots[slot];
      results.found = true;
    }
  });
  return results;
}

function buildDisambiguationPrompt(resolvedValues) {
  let output = "それなら";
  resolvedValues.forEach((resolvedValue, index) => {
     //output +=  `${(index === resolvedValues.length - 1) ? ' ' : ', '}${resolvedValue.value}`;
     output += `${resolvedValue.value}、`;
  });
  output += "がおすすめです。どれにしますか？";
  return output;
}

function disambiguateSlot(slots) {
  let result;
  for(let slotName in slots) {
      if (slots[slotName].resolvedValues.length > 1 && requiredSlots[slotName]) {
          console.log('disambiguate:', slots[slotName]);
          result = {
              slotName: slotName,
              prompt: buildDisambiguationPrompt(slots[slotName].resolvedValues)
          };
          break;
      }
  }
  return result;
}

// given an intent and an array slots, intentSlotsHaveBeenFilled will determine
// if all of the slots in the array have been filled.
// Returns:
// (true | false)
function intentSlotsHaveBeenFilled(intent, slots){
  const slotValues = getSlotValues(intent.slots);
  console.log('slot values:', JSON.stringify(slotValues));
  let result = true;
  slots.forEach(slot => {
      console.log('intentSlotsHaveBeenFilled:', slot);
      if (!slotValues[slot].synonym) {
          result = false;
      }
  });

  return result;
}

function intentSlotsNeedDisambiguation(intent, slots) {
  console.log("intentSlotsNeedDisambiguation is processing");
  const slotValues = getSlotValues(intent.slots);
  let result = false;
  slots.forEach(slot => {
    console.log(slotValues[slot].resolvedValues.length);
    if(slotValues[slot].resolvedValues.length > 1) {
      result = true;
    }
  });
  console.log("intentSlotsNeedDisambiguation", result);
  return result;
}

function getCurrentTime(location) {

  const currentTime = Moment.utc().tz(location);
  return currentTime;
}

function getTimeOfDay(currentTime) {
  const currentHour = currentTime.hours();
  const currentMinutes = currentTime.minutes();
  
  const weightedHour = (currentMinutes >= 45) ? currentHour + 1 : currentHour;
  
  let timeOfDay = "midnight";
  if (weightedHour >= 6 && weightedHour <= 10) {
    timeOfDay = "breakfast";
  } else if (weightedHour == 11) {
    timeOfDay = "brunch";
  } else if (weightedHour >= 12 && weightedHour <= 16) {
    timeOfDay = "lunch";
  } else if (weightedHour >= 17 && weightedHour <= 23) {
    timeOfDay = "dinner";
  }
  return timeOfDay;
}


const skillBuilder = Alexa.SkillBuilders.standard();

exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestWithConsentTokenHandler,
    LaunchRequestHandler,
    SuggestMealRecommendationIntentHandler,
    // promptForDeliveryOption,
    SIPRecommendationIntentHandler,    
    CRecommendationIntentHandler,
    LookupRestaurantIntentHandler,
    // GetMealIntentHandler,
    InProgressHasZipCaptureAddressIntentHandler,
    InProgressHasCityStateCaptureAddressIntentHandler,
    InProgressCaptureAddressIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler
  )
  .addRequestInterceptors(
    NewSessionRequestInterceptor,
    SetTimeOfDayInterceptor,
    HasConsentTokenRequestInterceptor,
    RecommendationIntentStartedRequestInterceptor,
    RecommendationIntentCaptureSlotToProfileInterceptor,
    CaptureAddressIntentCaptureSlotsToProfileInterceptor,
    DialogManagementStateInterceptor
  )
  .addResponseInterceptors(SessionWillEndInterceptor)
  .addErrorHandlers(ErrorHandler)
  //.withPersistenceApapter()
  //.withApiClient(new Alexa.DefaultApiClient())
  .withAutoCreateTable(true)
  .withTableName("theFoodie")
  .lambda();