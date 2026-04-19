
function gameTimeTrigger(exec) {
  //Logger.log(exec)
  main(exec.triggerUid)
}


function setAllGameTriggers() {
  setGameTrigger(0)
  Utilities.sleep(2000)
  setGameTrigger(1)
  Utilities.sleep(2000)
  setGameTrigger(2)

  //remove scheduledTriggerID
  setGameTrigger(3)
}

function setPostGameTriggers() {
  setTriggerAfterMilliseconds = (15 * 60 * 1000) //remove game triggers 15 minutes after game end
  scheduledTriggerID0 = ScriptApp.newTrigger('removeGameTriggers').timeBased().after(setTriggerAfterMilliseconds).create().getUniqueId();

  setTriggerAfterMilliseconds = (180 * 60 * 1000) //write media log 3 hours after game end
  scheduledTriggerID1 = ScriptApp.newTrigger('writeMediaLog').timeBased().after(setTriggerAfterMilliseconds).create().getUniqueId();

  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("GameState");
  sheet.getRange(2,6,1,1).setValue(scheduledTriggerID0); 
  Logger.log('scheduledTriggerID0 = ' + scheduledTriggerID0)

  sheet.getRange(2,7,1,1).setValue(scheduledTriggerID1); 
  Logger.log('scheduledTriggerID1 = ' + scheduledTriggerID1)


}

function determineTriggerRemove(gameState) {
  gameState = gameState ?? loadPreviousGameState()


  //gameState.scriptRunHistory = [{dateTime: '2025-09-01 15:49:05', triggerUid: '1424534962880316500'}, {dateTime: '2025-09-01 15:49:42', triggerUid: -'4583400889229628024'}, {dateTime: '2025-09-01 15:49:44', triggerUid: -'7403147521038688760'}, {dateTime: '2025-09-01 15:50:07', triggerUid: '1424534962880316500'}, {dateTime: '2025-09-01 15:50:43', triggerUid: -'7403147521038688760'}, {triggerUid: '1424534962880316500', dateTime: '2025-09-01 15:51:05'}]

  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("GameState");
  let triggerIDs = sheet.getRange(2,3,1,3).getValues()[0];  

  gameState.scriptRunHistory =  [{triggerUid:"-5871744729331320786",dateTime:"2025-09-02 19:36:06"},{triggerUid:"1702352590643973643",dateTime:"2025-09-02 19:36:20"},{triggerUid:"6754059454546477527",dateTime:"2025-09-02 19:36:27"},{triggerUid:"-5871744729331320786",dateTime:"2025-09-02 19:37:08"},{triggerUid:"1702352590643973643",dateTime:"2025-09-02 19:37:19"},{triggerUid:"6754059454546477527",dateTime:"2025-09-02 19:37:26"},{triggerUid:"-5871744729331320786",dateTime:"2025-09-02 19:38:08"},{triggerUid:"1702352590643973643",dateTime:"2025-09-02 19:38:17"},{triggerUid:"6754059454546477527",dateTime:"2025-09-02 19:38:25"}]

  
  triggerData = {}
  

  Logger.log(triggerIDs)

  for (let i = 0; i < triggerIDs.length; i++) {
    triggerTimeArrays = []
    for (let j= 0; j < gameState.scriptRunHistory.length; j++) {
      if (triggerIDs[i] != gameState.scriptRunHistory[j].triggerUid)
        triggerTimeArrays.push(gameState.scriptRunHistory[j])

        //diff = triggerTimeDifference(gameState.scriptRunHistory[j].dateTime, gameState.scriptRunHistory[(j + 1) % gameState.scriptRunHistory.length].dateTime)
      //Logger.log(`${gameState.scriptRunHistory[i].triggerUid}: ${diff}`)
    }    
    triggerData[triggerIDs[i]] = triggerTimeArrays


  }
  Logger.log(triggerData)

  triggerAverageTimes = {}

  for (const [key, value] of Object.entries(triggerData)) {
    //compare all values except last to first
    varianceArray = []
    Logger.log(`process: ${key}`)
    for (let i = 0; i < value.length - 1; i++) {
      diff = triggerTimeDifference(value[i].dateTime, value[(i + 1) % value.length].dateTime)
      varianceArray.push(diff)
      Logger.log(`${value[i].triggerUid}: ${diff}`)
    }
    triggerAverageTimes[key] = getStandardDeviation(varianceArray)
  }

    Logger.log(triggerAverageTimes)


  let key = Object.keys(triggerAverageTimes).reduce((key, v) => triggerAverageTimes[v] < triggerAverageTimes[key] ? v : key);

  Logger.log(key)

  triggerNumber = triggerIDs.indexOf(key)

  Logger.log(triggerNumber)

  setGameTrigger(triggerNumber)
}



function removeGameTriggers() {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("GameState");
  let triggerIDs = sheet.getRange(2,3,1,3).getValues()[0];  

  Logger.log(triggerIDs)

  for (let i = 0; i < triggerIDs.length; i++) {
    if (triggerIDs[i] != '') {
      Logger.log('turning off trigger=' + i)
      setGameTrigger(i)
    }
  }

  //setGameTrigger0();
  //setGameTrigger1();
  //setGameTrigger2();

  //remove scheduledTriggerID
  setGameTrigger(3)
}


function triggerTimeDifference(lastPostTime0, lastPostTime1) {
  //Logger.log(lastPostTime0)
  //Logger.log(lastPostTime1)  
  //previousGameState = loadPreviousGameState();
  currentDateTime = new Date();

  lastPostTime0 = new Date( Date.parse(lastPostTime0) );
  lastPostTime1 = new Date( Date.parse(lastPostTime1) );
  //Logger.log(currentDateTime)
  //Logger.log(lastPostTime)

  var diff =(lastPostTime0.getTime() - lastPostTime1.getTime()) / 1000;
  //diff /= 60;
  let differenceInSecs = Math.abs(Math.round(diff));

  //Logger.log(differenceInSecs)
  //Logger.log(differenceInSecs > minuteThreshold ? true : false)
  
  return differenceInSecs
}



function testDate(){
  let dateTime = new Date();
  let timezone = Session.getScriptTimeZone();  
  let year = Logger.log(Utilities.formatDate(dateTime, timezone, "yyyy")   )
}


function setTodayGameTrigger() {
  var dateTime = new Date();
  var timezone = Session.getScriptTimeZone();
  dateToday = Utilities.formatDate(dateTime, timezone, "yyyy-MM-dd");    
  schedule = pullFullSchedule()

  gameInfoToday = {}

  for (let game of schedule) {
    if (game.officialDate == dateToday ) {
      gameInfoToday = game;
      break;
    }
  }

  Logger.log('set trigger for game today')
  Logger.log(gameInfoToday)
   
  setTriggerAfterMilliseconds = (gameInfoToday.gameDate - dateTime) - (35 * 60 * 1000) //start 35 minutes before gametime

  Logger.log('setTriggerAfterMilliseconds = ' + setTriggerAfterMilliseconds) 

  setTriggerAfterMilliseconds = setTriggerAfterMilliseconds < 0 ? 100 : setTriggerAfterMilliseconds;
  //save scheduledTriggerID
  //Logger.log(setTriggerAfterMilliseconds)
  //setTriggerAfterMilliseconds = 50000
  scheduledTriggerID = ScriptApp.newTrigger('setAllGameTriggers').timeBased().after(setTriggerAfterMilliseconds).create().getUniqueId();

  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("GameState");
  sheet.getRange(2,6,1,1).setValue(scheduledTriggerID); 
  Logger.log('scheduledTriggerID = ' + scheduledTriggerID)

  //setTriggerAfterMilliseconds = setTriggerAfterMilliseconds + (30 * 1 * 1000) //set second trigger 30 seconds after first trigger
  //ScriptApp.newTrigger('setGameTrigger1').timeBased().after(setTriggerAfterMilliseconds).create();

}

function testMinutesAdding() {

  var dateTime = new Date();
  var timezone = Session.getScriptTimeZone();
  dateToday = Utilities.formatDate(dateTime, timezone, "yyyy-MM-dd HH:mm:ss");   

  Logger.log(dateToday)
}



function setGameTrigger0() {
  setGameTrigger(0)
}

function setGameTrigger1() {
  setGameTrigger(1)
}

function setGameTrigger2() {
  setGameTrigger(2)
}

function setGameTrigger(triggerNumber) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("GameState");
  let triggerID = sheet.getRange(2,3 + triggerNumber,1,1).getValue();  
  Logger.log('triggerID = ' + triggerID)

    if (triggerID == undefined || triggerID == '') {
      newTrigger = ScriptApp.newTrigger('gameTimeTrigger').timeBased().everyMinutes(1).create().getUniqueId();
      Logger.log("set trigger=" + newTrigger)

      sheet.getRange(2,3 + triggerNumber,1,1).setValue(newTrigger);      

    }
    else {
      let toDeleteTrigger;
      var triggers = ScriptApp.getProjectTriggers(); // Get all installable triggers
      for (var i = 0; i < triggers.length; i++) {
        if (triggers[i].getUniqueId() == triggerID) { // Compare unique IDs
          toDeleteTrigger = triggers[i]; // Return the matching trigger
          break;
        }
      }

      Logger.log(toDeleteTrigger)

      toDeleteTrigger && ScriptApp.deleteTrigger(toDeleteTrigger)
      sheet.getRange(2,3 + triggerNumber,1,1).setValue('');      
    }

    return;
}
