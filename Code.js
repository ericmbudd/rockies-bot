function main(triggerUid) {
  Logger.log('triggerUid=' + triggerUid)

  //get script start datetime
  var timezone = Session.getScriptTimeZone();
  var dateTime = new Date();
  dateTime = Utilities.formatDate(dateTime, timezone, "yyyy-MM-dd");  

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(100)) {
    Logger.log('locked by other process');
    return;
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("GameState");
  var gameState;
  try {

  teamSchedule = pullCurrentSchedule(dateTime, dateTime);
  gameState = findCurrentGameState(teamSchedule);


  if (gameState == undefined) {
    gameState = {};
    gameState.detailedState = 'Not Scheduled'
    sheet.getRange(2,1,1,1).setValues([[JSON.stringify(gameState)]]);    
    Logger.log('no game found today')
    return
  }


  previousGameState = loadPreviousGameState();
  result = previousGameState.standingsActive != true ? pullMLBStandings(gameState) : (gameState.standings = previousGameState.standings, gameState.standingsActive = true)

  if (result.gamesSinceTacos != undefined ) {
    gameState.gamesSinceTacos = result.gamesSinceTacos;
  }
  else
  {
    gameState.gamesSinceTacos = previousGameState.gamesSinceTacos
  }


  /*
  const result = previousGameState.standingsActive !== true 
    ? pullMLBStandings(gameState) 
    : { standings: previousGameState.standings, standingsActive: true };

  if (result !== undefined) {
    gameState = result;
  }
  */

  gameState.mediaActive = previousGameState.mediaActive;
  gameState.mediaActivatedTime = previousGameState.mediaActivatedTime;
  gameState.mediaTeam = previousGameState.mediaTeam;
  gameState.mediaSynonym = previousGameState.mediaSynonym;
  gameState.mediaVideoPosted = previousGameState.mediaVideoPosted;

  gameState.queuedVideoHeadline = previousGameState.queuedVideoHeadline;
  gameState.queuedVideoLink = previousGameState.queuedVideoLink;
  gameState.queuedVideoDuration = previousGameState.queuedVideoDuration;
  gameState.queuedVideoOutput = previousGameState.queuedVideoOutput;
  gameState.queuedVideoDescription = previousGameState.queuedVideoDescription;

  gameState.lastPostBlueskyLink = previousGameState.lastPostBlueskyLink;
  gameState.lastPostParentUri = previousGameState.lastPostParentUri;
  gameState.lastPostParentCid = previousGameState.lastPostParentCid;
  gameState.lastReplyBlueskyLink = previousGameState.lastReplyBlueskyLink; // Typo: lastReplyParentUri
  gameState.lastReplyParentUri = previousGameState.lastReplyParentUri; // Corrected: lastReplyParentUri
  gameState.lastReplyParentCid = previousGameState.lastReplyParentCid; // Corrected: lastReplyParentCid

  gameState.postHistory = gameState.detailedState == 'Pre-Game' || gameState.detailedState == 'Final' ? [0] : previousGameState.postHistory;

  gameState.scriptRunHistory = gameState.detailedState == 'Pre-Game' || gameState.detailedState == 'Final' ? [] : previousGameState.scriptRunHistory;

  if (gameState.scriptRunHistory === undefined) {
    gameState.scriptRunHistory = []
  }
  else {
    gameState.scriptRunHistory = saveScriptPostHistory(gameState.scriptRunHistory, dateTime, triggerUid)
  }
  
  gameState.lastPostTime = gameState.detailedState == 'Pre-Game' || gameState.detailedState == 'Warmup' ? '' : previousGameState.lastPostTime;
  gameState.lastReplyTime = gameState.detailedState == 'Pre-Game' || gameState.detailedState == 'Warmup' ? '' : previousGameState.lastReplyTime;

  gameState.losingStateChanges = gameState.detailedState == 'Pre-Game' || gameState.detailedState == 'Warmup' ? 0 : previousGameState.losingStateChanges;
  gameState.winningStateChanges = gameState.detailedState == 'Pre-Game' || gameState.detailedState == 'Warmup' ? 0 : previousGameState.winningStateChanges;

  gameState.largestRunDeficit = gameState.detailedState == 'Pre-Game' || gameState.detailedState == 'Warmup' ? 0 : previousGameState.largestRunDeficit;
  //gameState.currentRunDeficit = gameState.detailedState == 'Pre-Game' || gameState.detailedState == 'Warmup' ? 0 : previousGameState.currentRunDeficit;

  gameState.largestRunLead = gameState.detailedState == 'Pre-Game' || gameState.detailedState == 'Warmup' ? 0 : previousGameState.largestRunLead;
  gameState.walkOff = gameState.detailedState == 'Pre-Game' || gameState.detailedState == 'Warmup' ? false : previousGameState.walkOff;



  

  gameState.gameMediaArrayLength = gameState.detailedState == 'Pre-Game' || gameState.detailedState == 'Warmup' ? 0 : previousGameState.gameMediaArrayLength;

  Logger.log(`gameState - detailedState:${gameState.detailedState} awayScore:${gameState.awayScore} homeScore:${gameState.homeScore} losingState:${gameState.losingState} largestRunDeficit:${gameState.largestRunDeficit} mediaActive:${gameState.mediaActive}`)


  //[gameState.losingStateChanges, gameState.winningStateChanges, gameState.largeThresholdMet, gameState.extraLargeThresholdMet, gameState.massiveThresholdMet, gameState.superThresholdMet, gameState.ultraThresholdMet, gameState.mediumWinThresholdMet, gameState.extraLargeWinThresholdMet, gameState.massiveWinThresholdMet, gameState.superWinThresholdMet, gameState.ultraWinThresholdMet] =
  
  gameState = determineLosingStateChanges(gameState, previousGameState)

  // Check mediaActive reply window using previous state (video processing happens outside the lock)
  let mediaTimeRef = (previousGameState.mediaActivatedTime && previousGameState.lastPostTime &&
    new Date(previousGameState.mediaActivatedTime) > new Date(previousGameState.lastPostTime))
    ? previousGameState.mediaActivatedTime
    : previousGameState.lastPostTime;
  gameState.mediaActive = gameState.mediaActive && mediaReplyThreshold(mediaTimeRef);

  /*
  Logger.log(highlightHeadline)
  Logger.log(highlightLink)
  Logger.log(blueskyLink)
  */


  // Use sentinel to detect if determinePost explicitly sets mediaActive (fresh event activation)
  let mediaActiveBeforeDeterminePost = gameState.mediaActive;
  gameState.mediaActive = undefined;
  [postArray, gameState] = determinePost(gameState, previousGameState);
  if (gameState.mediaActive === true) {
    // A new event fired — refresh the timer and allow a new video for this cycle
    gameState.mediaActivatedTime = new Date().toISOString();
    gameState.mediaVideoPosted = false;
    Logger.log('=> mediaActivatedTime refreshed by determinePost: ' + gameState.mediaActivatedTime);
    Logger.log('=> mediaVideoPosted reset to false for new event cycle.');
  } else {
    // determinePost didn't fire a new event — restore previous state
    gameState.mediaActive = mediaActiveBeforeDeterminePost;
  }
  if (postArray.length > 0) { Logger.log("Post=" + JSON.stringify(postArray)); }

  //postArray = ['test post 1']

  //check for duplicate posts, otherwise post. Only check if making a single post this run
  //sometimes taco's et al have legit reasons to double post
  //removed && postArray.length == 1 from post condition. why was that there?
  //it caused a bug where it posted a duplicate post when there were two posts in the queue
    postArray.forEach((element) => {
    gameState.currentPost = element.id;
    gameState = checkPostMade(gameState) ? gameState : recordPost(element.text, gameState);
  });


  if ((gameState.detailedState == 'Game Over' || gameState.detailedState == 'Final') && (previousGameState.detailedState == 'In Progress')) {
        gameState = pullMLBStandings(gameState);
  }

  logCurrentPlay(gameState);

  sheet.getRange(2,1,1,1).setValues([[JSON.stringify(gameState)]]);
  } finally {
    lock.releaseLock();
  }

  // Video processing outside the lock — downloadAndPostVideo can be long-running (30–60+ sec).
  // Concurrent runs are free to proceed with state logic and text posts during this time.
  // Re-read media gating fields from the sheet first: a concurrent run may have already posted
  // a video and set mediaVideoPosted=true while this run was inside the first lock.
  try {
    const latestStateStr = sheet.getRange(2,1,1,1).getValue();
    if (latestStateStr) {
      const latestState = JSON.parse(latestStateStr);
      gameState.mediaVideoPosted = latestState.mediaVideoPosted;
      gameState.queuedVideoLink = latestState.queuedVideoLink;
      gameState.queuedVideoHeadline = latestState.queuedVideoHeadline;
      gameState.queuedVideoDuration = latestState.queuedVideoDuration;
      gameState.queuedVideoOutput = latestState.queuedVideoOutput;
      gameState.queuedVideoDescription = latestState.queuedVideoDescription;
      Logger.log('=> Pre-video refresh: mediaVideoPosted=' + gameState.mediaVideoPosted + ' queuedVideoLink=' + gameState.queuedVideoLink);
    }
  } catch (e) {
    Logger.log('=> Pre-video state refresh failed: ' + e);
  }

  let mediaActiveBeforeTry = gameState.mediaActive;
  try {
    [gameState, outputHighlights] = processGameHighlights(gameState);
    gameState = postGameVideo(gameState);
  } catch (error) {
    Logger.log(error);
  }

  // Reset gameMediaArrayLength after Pre-Game/Warmup runs so the first In Progress run
  // always sees a count difference and writes the full highlight list to the sheet.
  if (gameState.detailedState == 'Pre-Game' || gameState.detailedState == 'Warmup') {
    gameState.gameMediaArrayLength = 0;
  }

  // If mediaActive was freshly set by video processing, record the activation time
  if (gameState.mediaActive === true && !mediaActiveBeforeTry) {
    gameState.mediaActivatedTime = new Date().toISOString();
    Logger.log('=> mediaActivatedTime refreshed from video processing: ' + gameState.mediaActivatedTime);
  }

  // Re-acquire lock to merge video-updated fields back onto the freshest sheet state,
  // avoiding overwriting changes made by a concurrent run during video processing.
  const videoLock = LockService.getScriptLock();
  videoLock.waitLock(30000);
  try {
    const currentStateStr = sheet.getRange(2,1,1,1).getValue();
    const freshState = currentStateStr ? JSON.parse(currentStateStr) : gameState;
    const videoFields = [
      'mediaActive', 'mediaActivatedTime', 'mediaVideoPosted',
      'queuedVideoLink', 'queuedVideoHeadline', 'queuedVideoDuration', 'queuedVideoOutput', 'queuedVideoDescription',
      'highlightHeadline', 'highlightLink', 'highlightDuration', 'highlightOutput', 'highlightDescription',
      'highlightKeywordsAll', 'highlightCaptivatingIndex', 'freeGame', 'gameMediaArrayLength'
    ];
    videoFields.forEach(f => { if (gameState[f] !== undefined) freshState[f] = gameState[f]; });
    sheet.getRange(2,1,1,1).setValues([[JSON.stringify(freshState)]]);
  } finally {
    videoLock.releaseLock();
  }
}


function logCurrentPlay(gameState) {
  try {
    let liveUrl = `https://statsapi.mlb.com/api/v1.1/game/${gameState.gamePk}/feed/live?fields=liveData,plays,currentPlay,result,type,event,eventType,description,rbi,awayScore,homeScore,isOut,about,atBatIndex,halfInning,isTopInning,inning,startTime,endTime,isComplete,isScoringPlay,hasReview,hasOut,captivatingIndex,count,balls,strikes,outs,matchup,batter,id,fullName,link,batSide,code,description,pitcher,pitchHand,splits,batter,pitcher,menOnBase,pitchIndex,actionIndex,runnerIndex,runners,movement,originBase,start,end,outBase,isOut,outNumber,details,event,eventType,runner,isScoringEvent,rbi,earned,teamUnearned,playIndex,credits,player,position,name,abbreviation,credit`;
    Logger.log('logCurrentPlay url: https://statsapi.mlb.com/api/v1.1/game/' + gameState.gamePk + '/feed/live');
    let liveResponse = JSON.parse(UrlFetchApp.fetch(liveUrl));
    let play = liveResponse.liveData.plays.currentPlay;
    let about = play.about || {};
    let result = play.result || {};
    let matchup = play.matchup || {};
    let count = play.count || {};
    let runners = play.runners || [];

    let halfInning = about.isTopInning ? 'Top' : 'Bottom';
    let battingTeam = about.isTopInning ? gameState.awayTeam : gameState.homeTeam;
    let pitchingTeam = about.isTopInning ? gameState.homeTeam : gameState.awayTeam;
    Logger.log(`--- Current Play: ${halfInning} of inning ${about.inning} | At-bat #${about.atBatIndex || '?'} | ${about.isComplete ? 'Complete' : 'In progress'} ---`);
    Logger.log(`${battingTeam || 'Away'} batting vs ${pitchingTeam || 'Home'} pitching`);
    Logger.log(`Batter: ${matchup.batter?.fullName || 'N/A'} (${matchup.batSide?.description || '?'}) vs Pitcher: ${matchup.pitcher?.fullName || 'N/A'} (${matchup.pitchHand?.description || '?'})`);
    Logger.log(`Count: ${count.balls}-${count.strikes}, ${count.outs} out(s)`);
    Logger.log(`Result: ${result.type || '?'} - ${result.event || 'In progress'} - ${result.description || ''}`);
    Logger.log(`Score: Away ${result.awayScore} - Home ${result.homeScore} | RBI: ${result.rbi || 0} | Scoring play: ${about.isScoringPlay}${about.hasReview ? ' | UNDER REVIEW' : ''}`);
    if (about.captivatingIndex != null) Logger.log(`Captivating index: ${about.captivatingIndex}`);
    Logger.log(`Men on base: ${JSON.stringify(play.matchup?.splits?.menOnBase || 'N/A')}`);

    if (runners.length > 0) {
      for (let r of runners) {
        let movement = r.movement || {};
        let details = r.details || {};
        let earnedStr = details.earned ? ' (earned)' : details.teamUnearned ? ' (unearned)' : '';
        let outStr = movement.isOut ? ` | OUT at ${movement.outBase || '?'} (#${movement.outNumber || '?'})` : '';
        Logger.log(`Runner: ${details.runner?.fullName || 'N/A'} | ${movement.start || 'N/A'} → ${movement.end || 'N/A'} | Scoring: ${details.isScoringEvent || false}${earnedStr}${outStr}`);
      }
    }

    if (play.credits && play.credits.length > 0) {
      let creditStr = play.credits.map(c => `${c.player?.fullName || 'N/A'} (${c.credit || ''})`).join(', ');
      Logger.log(`Credits: ${creditStr}`);
    }
  } catch (e) {
    Logger.log('Failed to fetch live game data: ' + e);
  }
}


function saveScriptPostHistory(scriptRunHistory, dateTime, triggerUid) {
  scriptRunHistory.push({triggerUid: triggerUid, dateTime: dateTime})

  //return last 10 elements
  return scriptRunHistory.slice(Math.max(scriptRunHistory.length - 9, 0))

}


function pullMLBStandings(gameState) {
  gameState = gameState ?? loadPreviousGameState()
  //hydrations = '&hydrate=gameInfo,linescore,probablePitcher' //add 'hydrations' to see other possible
  //both leagues at once
  //https://statsapi.mlb.com/api/v1/standings?leagueId=104,103

  standingsTypes = gameState.gameType == 'S' ? 'springTraining' : 'regularSeason';
  let dateTime = new Date();
  let timezone = Session.getScriptTimeZone();  
  let year = Utilities.formatDate(dateTime, timezone, "yyyy")
  //https://statsapi.mlb.com/api/v1/standings?leagueId=104,103&season=2026&standingsTypes=springTraining&hydrate=hydrations,team,record(division)

  url = 'https://statsapi.mlb.com/api/v1/standings?leagueId=104,103&season=' + year + '&standingsTypes=' + standingsTypes + '&hydrate=hydrations,team,record(division)' //+ hydrations
  
  Logger.log('standings url=' + url)
  
  let response = JSON.parse(UrlFetchApp.fetch(url))//.getContentText();
  standings = response

  //test standings
  //gameState = loadPreviousGameState();
  //standings = getTestStandings();

  myTeam = gameState[gameState.myTeamHomeStatus + 'Team']
  opposingTeam = gameState[gameState.opponentHomeStatus + 'Team']

  gameState.gamesSinceTacos = gamesSinceTacos();
  Logger.log('gameState.gamesSinceTacos= ' + gameState.gamesSinceTacos)

  gameState.standingsActive = true
  gameState.standings = {}

  for (let division of standings.records) {
    for (let value of division.teamRecords) {
      Logger.log(value.team.name)
      //Logger.log(value.teams.away.team.name)

      if (value.team.name == opposingTeam) {
        Logger.log('opposingteaminfo')
        Logger.log(value.team)

        gameState.standings.opposingStarterHand = pullMLBPerson(gameState[gameState.opponentHomeStatus + 'ProbablePitcherLink']).pitchHand.description.toLowerCase();

        gameState.standings.opposingLeague = value.team.league.name
        gameState.standings.opposingDivision = value.team.division.name
        gameState.standings.opposingSportRank = value.sportRank;

        gameState.standings.opposingGamesPlayed = value.gamesPlayed
        gameState.standings.opposingRunsAllowed = value.runsAllowed;
        gameState.standings.opposingRunsScored = value.runsScored;
        gameState.standings.opposingPythagoreanWinPct = value.runsScored**2 / (value.runsScored**2 + value.runsAllowed**2);

        gameState.standings.opposingSplitRecords = {}
        for (let split of value.records.splitRecords) {
          gameState.standings.opposingSplitRecords[split.type] = split;
        }

      }

      if (value.team.name == myTeam) {
        gameState.standings.myTeamStarterHand = pullMLBPerson(gameState[gameState.myTeamHomeStatus + 'ProbablePitcherLink']).pitchHand.description.toLowerCase();
        
        gameState.standings.myTeamSportRank = value.sportRank;

        if (value.streak) {
            gameState.standings.streakType = value.streak.streakType;
            gameState.standings.streakNumber = value.streak.streakNumber;
        }
        
        gameState.standings.myTeamRecordLosses = value.leagueRecord.losses
        gameState.standings.myTeamRecordWins = value.leagueRecord.wins

        gameState.standings.myTeamGamesPlayed = value.gamesPlayed
        gameState.standings.myTeamRunsAllowed = value.runsAllowed;
        gameState.standings.myTeamRunsScored = value.runsScored;
        gameState.standings.myTeamPythagoreanWinPct = value.runsScored**2 / (value.runsScored**2 + value.runsAllowed**2);

        gameState.standings.myTeamLeague = value.team.league.name
        gameState.standings.myTeamDivision = value.team.division.name
        gameState.standings.divisionGamesBack = value.divisionGamesBack
        
        //gameState.standings.divisionRecords = value.records.divisionRecords
        gameState.standings.eliminationNumber = value.eliminationNumber
        gameState.standings.wildCardEliminationNumber = value.wildCardEliminationNumber


        //gameState.standings.myTeamSplitRecords = value.records.splitRecords

        gameState.standings.myTeamSplitRecords = {}
        for (let split of value.records.splitRecords) {
          gameState.standings.myTeamSplitRecords[split.type] = split;
        }

        if (gameState.standings.opposingLeague == 'American League') {
          gameState.standings.opposingDLWins = value.records.leagueRecords[0].wins
          gameState.standings.opposingDLLosses = value.records.leagueRecords[0].losses
        }
        else
        {
          for (let divisionRecords of value.records.divisionRecords) {
            //Logger.log(divisionRecords.division.name + ' = ' + gameState.standings.opposingDivision)
            if (divisionRecords.division.name == gameState.standings.opposingDivision) {
              Logger.log(division.name)
              gameState.standings.opposingDLWins = divisionRecords.wins
              gameState.standings.opposingDLLosses = divisionRecords.losses
            }
          }
        }
      }
    }
  }
  //Logger.log(gameState.standings)

  return gameState
}

function predictionModel(gameState) {
  gameState = gameState ?? loadPreviousGameState()

  baseMyTeamWinProbability = initialMyTeamWinProbability = gameState[gameState.myTeamHomeStatus + 'WinPct'];

  Logger.log(`baseMyTeamWinProbability=` + baseMyTeamWinProbability)

  probabilityTweaks = []

  probabilityTweaks.push({type: 'opposingWinPct', weighting: 1, value: 1 - (1 - (gameState.standings.opposingSportRank/30) - .5) })
  probabilityTweaks.push({type: 'myTeamLocation', weighting: .5,
  value: gameState.standings.myTeamSplitRecords[gameState.myTeamHomeStatus].pct / gameState[gameState.myTeamHomeStatus + 'WinPct']})
  probabilityTweaks.push({type: 'opposingTeamLocation', weighting: .5,
  value: 1 - (gameState.standings.opposingSplitRecords[gameState.opponentHomeStatus].pct / gameState[gameState.opponentHomeStatus + 'WinPct'] - 1)})  
  probabilityTweaks.push({type: 'myTeamL10', weighting: .33,
  value: gameState.standings.myTeamSplitRecords.lastTen.pct / gameState[gameState.myTeamHomeStatus + 'WinPct']})
  probabilityTweaks.push({type: 'opposingTeamL10', weighting: .33,
  value: 1 - (gameState.standings.opposingSplitRecords.lastTen.pct / gameState[gameState.opponentHomeStatus + 'WinPct'] - 1)}) 
  probabilityTweaks.push({type: 'opposingTeamPythagoreanWin', weighting: .75,
  value: 1 - (gameState.standings.opposingPythagoreanWinPct / gameState[gameState.opponentHomeStatus + 'WinPct'] - 1)})
  probabilityTweaks.push({type: 'myTeamPythagoreanWin', weighting: .75,
  value: gameState.standings.myTeamPythagoreanWinPct / gameState[gameState.myTeamHomeStatus + 'WinPct']})
  probabilityTweaks.push({type: 'opposingDayNight', weighting: .25,
  value: 1 - (gameState.standings.opposingSplitRecords[gameState.dayNight].pct / gameState[gameState.opponentHomeStatus + 'WinPct'] - 1)}) 
  probabilityTweaks.push({type: 'myTeamDayNight', weighting: .25,
  value: gameState.standings.myTeamSplitRecords[gameState.dayNight].pct / gameState[gameState.myTeamHomeStatus + 'WinPct']})

  //splits for opposing team starting pitcher hand vs. my team split stats
  probabilityTweaks.push({type: 'opposingStarterHand', weighting: .33,
  value: gameState.standings.myTeamSplitRecords[gameState.standings.opposingStarterHand].pct / gameState[gameState.myTeamHomeStatus + 'WinPct']})

  //splits for my team starting pitcher hand vs. opposing team split stats
  probabilityTweaks.push({type: 'myTeamStarterHand', weighting: .33,
  value: 1 - (gameState.standings.opposingSplitRecords[gameState.standings.myTeamStarterHand].pct / gameState[gameState.opponentHomeStatus + 'WinPct'] - 1)}) 


//gameState.opposingStarterHand
//gameState.standings.opposingPythagoreanWinPct

/*
  probabilityTweaks.push({type: 'myTeamDayNight', weighting: .25,
  value: gameState.standings.myTeamSplitRecords.lastTen.pct / gameState[gameState.myTeamHomeStatus + 'WinPct']})
  probabilityTweaks.push({type: 'opposingDayNight', weighting: .25,
  value: 1 - (gameState.standings.opposingSplitRecords.lastTen.pct / gameState[gameState.opponentHomeStatus + 'WinPct'] - 1)}) 
*/

// NEW: Filter out 0, NaN, and Infinity values
  probabilityTweaks = probabilityTweaks.filter(tweak => {
    return tweak.value !== 0 && isFinite(tweak.value) && !isNaN(tweak.value);
  });

  for (let rec of probabilityTweaks ) {
    weightedValue =  (((rec.value - 1) * rec.weighting) + 1)
    baseMyTeamWinProbability = baseMyTeamWinProbability * weightedValue
    Logger.log('weightedValue=' + weightedValue)
    Logger.log(`new baseMyTeamWinProbability after ${rec.type}=` + baseMyTeamWinProbability)
  }


  probabilityTweaks.push({type: 'initialMyTeamWinProbability', value: initialMyTeamWinProbability})

  Logger.log(probabilityTweaks)

  Logger.log(baseMyTeamWinProbability)

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Prediction Model");
  var postCount = Number(sheet.getRange(1,10,1,1).getValues());

  //get date and time info
  var timezone = Session.getScriptTimeZone();
  var dateTime = new Date();
  dateTime = Utilities.formatDate(dateTime, timezone, "yyyy-MM-dd");  

  sheet.getRange(1 + postCount,1,1,5).setValues([[dateTime, gameState[gameState.myTeamHomeStatus + 'Team'], baseMyTeamWinProbability, JSON.stringify(probabilityTweaks), JSON.stringify(gameState)]]);

  return baseMyTeamWinProbability;

}


function outputFinalScoreInfo (gameState) {
  //gameState = loadPreviousGameState()
  var timezone = Session.getScriptTimeZone();
  var dateTime = new Date();
  dateTimeString = Utilities.formatDate(dateTime, timezone, "yyyy-MM-dd");
  myTeam = gameState[gameState.myTeamHomeStatus + 'Team']
  opposingTeam = gameState[gameState.opponentHomeStatus + 'Team']
  result = gameState[gameState.myTeamHomeStatus + 'Score'] < gameState[gameState.opponentHomeStatus  + 'Score'] ? 'L' : 'W';
  myTeamRuns = gameState[gameState.myTeamHomeStatus + 'Score']
  opposingTeamRuns = gameState[gameState.opponentHomeStatus  + 'Score']
  homeStatus = gameState.myTeamHomeStatus
  gamesInSeries = gameState.gamesInSeries

  outputArray = [dateTimeString, myTeam, opposingTeam, result, myTeamRuns, opposingTeamRuns, homeStatus, gamesInSeries];


  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("TeamRecord");
  var gameCount = Number(sheet.getRange(2,14,1,1).getValues());

  Logger.log(gameCount)
  Logger.log(outputArray)

  sheet.getRange(3 + gameCount,1,1,outputArray.length).setValues([outputArray]);
}


function checkPostMade(gameState) {
  gameState = gameState ?? loadPreviousGameState()

  if (gameState.postHistory === undefined) {
    gameState.postHistory = []
  }
  else
  {
    Logger.log('checkPostMade=' + gameState.postHistory.includes(gameState.currentPost))
  }

  return gameState.postHistory.includes(gameState.currentPost)
}

function testExtraPostThreshold () {
  previousGameState = loadPreviousGameState();
  value = extraPostThreshold(previousGameState.lastPostTime, 30)

  Logger.log(value)
}

function extraPostThreshold(lastPostTime, minuteThreshold) {
  //previousGameState = loadPreviousGameState();
  currentDateTime = new Date();

  lastPostTime = new Date( Date.parse(lastPostTime) );
  //Logger.log(currentDateTime)
  //Logger.log(lastPostTime)

  var diff =(currentDateTime.getTime() - lastPostTime.getTime()) / 1000;
  diff /= 60;
  let differenceInMins = Math.abs(Math.round(diff));

  //Logger.log(differenceInMins)
  //Logger.log(differenceInMins > minuteThreshold ? true : false)
  
  return differenceInMins > minuteThreshold ? true : false
}

function mediaReplyThreshold(replyByTime, minuteThreshold) {
  //previousGameState = loadPreviousGameState();
  currentDateTime = new Date();

  //set to 6 when live
  minuteThreshold = 5;

  replyByTime = new Date( Date.parse(replyByTime) );
  //Logger.log(currentDateTime)
  //Logger.log(lastPostTime)

  var diff = (currentDateTime.getTime() - replyByTime.getTime()) / 1000;
  diff /= 60;
  let differenceInMins = Math.abs(Math.round(diff));

  //Logger.log(differenceInMins)
  //Logger.log(differenceInMins > minuteThreshold ? true : false)
  
  return differenceInMins < minuteThreshold ? true : false
}


function determineLosingStateChanges (gameState, previousGameState) {
  mediumWinThreshold = 3;
  extraLargeWinThreshold = 5;
  massiveWinThreshold = 7;
  superWinThreshold = 9;
  superWinThreshold = 12;
  ultraWinThreshold = 15;


  largeThreshold = 3;
  extraLargeThreshold = 5;
  massiveThreshold = 7;
  superThreshold = 9;
  ultraThreshold = 12;

  if (gameState.detailedState == 'In Progress' && gameState.losingState == 'Losing' && previousGameState.losingState != 'Losing') {
    //Logger.log('losingStateChanges prev' + gameState.losingStateChanges)
    gameState.losingStateChanges = gameState.losingStateChanges + 1;
    //Logger.log('losingStateChanges after' + gameState.losingStateChanges)
  }

  if (gameState.detailedState == 'In Progress' && gameState.losingState == 'Not Losing' && previousGameState.losingState != 'Not Losing') {
    //Logger.log('winningStateChanges prev' + gameState.winningStateChanges)
    gameState.winningStateChanges = gameState.winningStateChanges + 1;
    //Logger.log('winningStateChanges after' + gameState.winningStateChanges)
  }  

  //Logger.log('largest run lead')
  //Logger.log(gameState[gameState.myTeamHomeStatus  + 'Score'] - gameState[gameState.opponentHomeStatus + 'Score'])
  //Logger.log(gameState.largestRunLead)

  gameState.largestRunDeficit = gameState.largestRunDeficit < gameState[gameState.opponentHomeStatus  + 'Score'] - gameState[gameState.myTeamHomeStatus + 'Score'] ? gameState[gameState.opponentHomeStatus  + 'Score'] - gameState[gameState.myTeamHomeStatus + 'Score'] : gameState.largestRunDeficit;
  gameState.currentRunDeficit = gameState[gameState.opponentHomeStatus  + 'Score'] - gameState[gameState.myTeamHomeStatus + 'Score']


  gameState.largestRunLead = gameState.largestRunLead < gameState[gameState.myTeamHomeStatus  + 'Score'] - gameState[gameState.opponentHomeStatus + 'Score'] ? gameState[gameState.myTeamHomeStatus  + 'Score'] - gameState[gameState.opponentHomeStatus + 'Score'] : gameState.largestRunLead;

  gameState.largeThresholdMet = gameState[gameState.opponentHomeStatus  + 'Score'] - gameState[gameState.myTeamHomeStatus + 'Score'] > largeThreshold  ? true : false;
  gameState.extraLargeThresholdMet = gameState[gameState.opponentHomeStatus  + 'Score'] - gameState[gameState.myTeamHomeStatus + 'Score'] > extraLargeThreshold  ? true : false;
  gameState.massiveThresholdMet = gameState[gameState.opponentHomeStatus  + 'Score'] - gameState[gameState.myTeamHomeStatus + 'Score'] > massiveThreshold  ? true : false;
  gameState.superThresholdMet = gameState[gameState.opponentHomeStatus  + 'Score'] - gameState[gameState.myTeamHomeStatus + 'Score'] > superThreshold  ? true : false;
  gameState.ultraThresholdMet = gameState[gameState.opponentHomeStatus  + 'Score'] - gameState[gameState.myTeamHomeStatus + 'Score'] > ultraThreshold  ? true : false;

  gameState.mediumWinThresholdMet =  gameState[gameState.myTeamHomeStatus + 'Score'] - gameState[gameState.opponentHomeStatus  + 'Score'] > mediumWinThreshold  ? true : false;
  gameState.extraLargeWinThresholdMet = gameState[gameState.myTeamHomeStatus + 'Score'] - gameState[gameState.opponentHomeStatus  + 'Score'] > extraLargeWinThreshold  ? true : false;   
  gameState.massiveWinThresholdMet = gameState[gameState.myTeamHomeStatus + 'Score'] - gameState[gameState.opponentHomeStatus  + 'Score'] > massiveWinThreshold  ? true : false;   
  gameState.superWinThresholdMet = gameState[gameState.myTeamHomeStatus + 'Score'] - gameState[gameState.opponentHomeStatus  + 'Score'] > superWinThreshold  ? true : false;  
  gameState.ultraWinThresholdMet = gameState[gameState.myTeamHomeStatus + 'Score'] - gameState[gameState.opponentHomeStatus  + 'Score'] > ultraWinThreshold  ? true : false;   

  //return [gameState.losingStateChanges, gameState.winningStateChanges, gameState.largeThresholdMet, gameState.extraLargeThresholdMet, gameState.massiveThresholdMet, gameState.superThresholdMet, gameState.ultraThresholdMet, gameState.mediumWinThresholdMet, gameState.extraLargeWinThresholdMet, gameState.massiveWinThresholdMet, gameState.superWinThresholdMet, gameState.ultraWinThresholdMet];

  return gameState;

}


function recordPost(postText, gameState, isReply) {
  Logger.log('recordPost')
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Posts");
  var postCount = Number(sheet.getRange(1,8,1,1).getValues());

  //get date and time info
  var timezone = Session.getScriptTimeZone();
  var dateTime = new Date();
  dateTime = Utilities.formatDate(dateTime, timezone, "yyyy-MM-dd HH:mm:ss");  

  var [blueskyLink, uri, cid] = postBluesky(postText);

  Logger.log([blueskyLink, uri, cid])


  //var [blueskyLink, uri, cid] = ['https://bsky.app/profile/didtherockieslose.bsky.social/post/3lw67xbmhh52w', 'at://did:plc:dkanfr5ivoi3hat7pz6fjiat/app.bsky.feed.post/3lw67xbmhh52w', 'bafyreign6e4ivp7lbp6qj4eeoxgnyh7gk7xibkrowjxoa2ixqwcnupxtey']

  gameState.lastPostTime = dateTime
  gameState.lastPostBlueskyLink = blueskyLink
  gameState.lastPostParentUri = uri
  gameState.lastPostParentCid = cid

  if (isReply) {
    gameState.lastReplyUri = uri
    gameState.lastReplyCid = cid
    gameState.lastReplyBlueskyLink = blueskyLink
  }

  gameState.currentPost != null && gameState.postHistory.push(gameState.currentPost)

  sheet.getRange(2 + postCount,1,1,4).setValues([[dateTime, postText, gameState.highlightOutput, blueskyLink]]);
  sheet.getRange(1,8,1,1).setValue(  [Number(postCount + 1)] );



  return gameState
}



function recordPlayoffPost(postText, playoffState, isReply, aG) {
  Logger.log('recordPlayoffPost')
  isReply = playoffState[aG].lastPostParentUri != null;
  Logger.log('isReply=' + isReply)

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Posts");
  var postCount = Number(sheet.getRange(1,8,1,1).getValues());

  //get date and time info
  var timezone = Session.getScriptTimeZone();
  var dateTime = new Date();
  dateTime = Utilities.formatDate(dateTime, timezone, "yyyy-MM-dd HH:mm:ss");  


  if (isReply) {
    var [blueskyLink, uri, cid] = postBluesky(postText, {uri: playoffState[aG].lastPostParentUri, cid: playoffState[aG].lastPostParentCid}, {uri: playoffState[aG].lastPostParentUri, cid: playoffState[aG].lastPostParentCid})
  }
  else {
    var [blueskyLink, uri, cid] = postBluesky(postText);
  }


  Logger.log([blueskyLink, uri, cid])


  //var [blueskyLink, uri, cid] = ['https://bsky.app/profile/didtherockieslose.bsky.social/post/3lw67xbmhh52w', 'at://did:plc:dkanfr5ivoi3hat7pz6fjiat/app.bsky.feed.post/3lw67xbmhh52w', 'bafyreign6e4ivp7lbp6qj4eeoxgnyh7gk7xibkrowjxoa2ixqwcnupxtey']

  playoffState[aG].lastPostTime = dateTime
  playoffState[aG].lastPostBlueskyLink = blueskyLink
  playoffState[aG].lastPostParentUri = uri
  playoffState[aG].lastPostParentCid = cid

  if (isReply) {
    playoffState[aG].lastReplyUri = uri
    playoffState[aG].lastReplyCid = cid
    playoffState[aG].lastReplyBlueskyLink = blueskyLink
  }


  sheet.getRange(2 + postCount,1,1,4).setValues([[dateTime, postText, '', blueskyLink]]);
  sheet.getRange(1,8,1,1).setValue(  [Number(postCount + 1)] );



  return playoffState
}


function determinePost(gameState, previousGameState) {
  //The Rockies are currently on a true due to  inclement weather. That is no reason to push back the end.”
//The Rockies are currently on a undefined due to function toLowerCase() { [native code] }. That is no reason to prolong the pain.”

  messageArray = [];

  if (gameState.detailedState == 'Warmup' && (previousGameState.detailedState == 'Pre-Game' || previousGameState.detailedState == 'Final' || previousGameState.abstractGameState == 'Preview')) {
    gameState = pullMLBStandings(gameState);
    pull40ManRoster(gameState[gameState.myTeamHomeStatus + 'Team']);
    //setGameTrigger();
    modelPercent = predictionModel(gameState);
    clearCurrentGameMedia();
    
    message = `As the ${getShortName(gameState[gameState.myTeamHomeStatus + 'Team'])} warm up to play ${gameState.homeTeam != 'Colorado Rockies' ? 'an away game against ' : 'a home game against '}the ${gameState[gameState.opponentHomeStatus + 'Team']}${gameState.homeTeam == 'Colorado Rockies' ? ' at ' + gameState.venue : ''}, I predict that the ${getShortName(gameState[gameState.myTeamHomeStatus + 'Team'])} have ${((1-modelPercent)*100).toString().substring(0,1) == '8' ? 'an' : 'a'} ${((1-modelPercent)*100).toFixed(2)}% chance to lose based on various stats from each team.
    
${getSynonym('couldBeWrongSynonym')}`

    gameState.currentPost = 'warmup';
    messageArray.push({ text: message, id: gameState.currentPost });
  }

  if (gameState.detailedState == 'In Progress' && (previousGameState.detailedState == 'Pre-Game' || previousGameState.detailedState == 'Warmup' || previousGameState.detailedState.search('Delayed Start') != -1 )) {

    message = `${gameState.gameType == 'S' ? 'SPRING TRAINING: ' : ''}The ${getShortName(gameState[gameState.myTeamHomeStatus + 'Team'])} (${gameState[gameState.myTeamHomeStatus + 'Wins']}-${gameState[gameState.myTeamHomeStatus + 'Losses']}) have started playing ${gameState.myTeamHomeStatus == 'away' ? 'at the' : 'the'} ${gameState[gameState.opponentHomeStatus + 'Team']} (${gameState[gameState.opponentHomeStatus + 'Wins']}-${gameState[gameState.opponentHomeStatus + 'Losses']})${gameState.myTeamHomeStatus == 'home' ? ' at Coors Field' : ''}.
    
Catch the play-by-play live on MLB Gameday: https://www.mlb.com/gameday/${gameState.gamePk}`

    gameState.currentPost = 'gamestart';
    messageArray.push({ text: message, id: gameState.currentPost });
    
  }

  //there's a 'Review' detailed state which causes a losing state not to correctly update because game isn't live. I've included 'Live'
  //in the state below but there's a chance that the play could get overturned and the bot could post that Rockies are now losing when aren't
  //so need some way to handle that transitional state

  //Logger.log('losingStateChanges=' + gameState.losingStateChanges)

  if ((gameState.detailedState == 'In Progress' || gameState.abstractGameState == 'Live') && gameState.losingState == 'Not Losing' && previousGameState.losingState != 'Not Losing'
    && gameState.awayScore + gameState.homeScore > previousGameState.awayScore + previousGameState.homeScore) {
    message = gameState.winningStateChanges > 1 ? `The ${getShortName(gameState[gameState.myTeamHomeStatus + 'Team'])} are NOT losing, again. ${getSynonym('imSkepticalSynonym')}` : `The ${getShortName(gameState[gameState.myTeamHomeStatus + 'Team'])} are NOT losing. ${getSynonym('imSkepticalSynonym')}`

    gameState.currentPost = gameState.awayScore + gameState.homeScore;
    gameState.mediaActive = true;
    gameState.mediaTeam = 'Colorado Rockies';
    gameState.mediaSynonym = 'wentOkSynonym';

    if (gameState.currentInning > 8 && (gameState.inningState == 'Bottom' || gameState.inningState == 'End')) {
      gameState.walkOff = true;
      gameState.detailedState = 'Game Over'
    }
    else {
      messageArray.push({ text: message, id: gameState.currentPost });
    }
  }



  if ((gameState.detailedState == 'In Progress' || gameState.abstractGameState == 'Live') && gameState.losingState == 'Losing' && previousGameState.losingState != 'Losing'
  && gameState.awayScore + gameState.homeScore > previousGameState.awayScore + previousGameState.homeScore) {
    message = gameState.losingStateChanges > 1 ? `The ${getShortName(gameState[gameState.myTeamHomeStatus + 'Team'])} are now losing, again.` : `The ${getShortName(gameState[gameState.myTeamHomeStatus + 'Team'])} are now losing.`

    gameState.currentPost = gameState.awayScore + gameState.homeScore;
    gameState.mediaActive = true;
    gameState.mediaTeam = gameState[gameState.opponentHomeStatus + 'Team'];
    gameState.mediaSynonym = 'didntGoGreatSynonym';
    messageArray.push({ text: message, id: gameState.currentPost });
  }


  //TIED - only when Rockies tie it up
  if ((gameState.detailedState == 'In Progress' || gameState.abstractGameState == 'Live') && gameState.losingState == 'Tied' && previousGameState.losingState == 'Losing'
  && gameState.awayScore + gameState.homeScore > previousGameState.awayScore + previousGameState.homeScore) {
    message = `The ${getShortName(gameState[gameState.myTeamHomeStatus + 'Team'])} have tied the game. ${getSynonym('anythingCouldHappenNextSynonym')}`

    gameState.currentPost = gameState.awayScore + gameState.homeScore;
    gameState.mediaActive = true;
    gameState.mediaTeam = 'Colorado Rockies';
    gameState.mediaSynonym = 'wentOkSynonym';
    messageArray.push({ text: message, id: gameState.currentPost });
  }


  // losing by even-run milestones (2, 4, 6, 8, ...) or 3-run deficit — only when opponent scores
  if (gameState.losingState == 'Losing' && previousGameState.losingState == 'Losing'
    && gameState[gameState.opponentHomeStatus + 'Score'] > previousGameState[gameState.opponentHomeStatus + 'Score']
    && gameState.currentRunDeficit >= 2 && (gameState.currentRunDeficit % 2 == 0 || gameState.currentRunDeficit == 3)) {
    message = gameState.currentRunDeficit == 2
      ? `The ${getShortName(gameState[gameState.myTeamHomeStatus + 'Team'])} are getting ${getSynonym('getKilledSynonym')}, down ${gameState[gameState.opponentHomeStatus + 'Score']}-${gameState[gameState.myTeamHomeStatus + 'Score']}`
      : `The ${getShortName(gameState[gameState.myTeamHomeStatus + 'Team'])} are getting just ${getSynonym('getModifierSynonym')} ${getSynonym('getKilledSynonym')}, down ${gameState[gameState.opponentHomeStatus + 'Score']}-${gameState[gameState.myTeamHomeStatus + 'Score']}`;
    gameState.currentPost = gameState.awayScore + gameState.homeScore;
    gameState.mediaActive = true;
    gameState.mediaTeam = gameState[gameState.opponentHomeStatus + 'Team'];
    gameState.mediaSynonym = 'didntGoGreatSynonym';
    messageArray.push({ text: message, id: gameState.currentPost });
  }

  // winning by even-run milestones (2, 4, 6, 8, ...) or 3-run lead — only when Rockies score
  if (gameState.losingState == 'Not Losing' && previousGameState.losingState == 'Not Losing'
    && gameState[gameState.myTeamHomeStatus + 'Score'] > previousGameState[gameState.myTeamHomeStatus + 'Score']) {
    let currentLead = gameState[gameState.myTeamHomeStatus + 'Score'] - gameState[gameState.opponentHomeStatus + 'Score'];
    if (currentLead >= 2 && (currentLead % 2 == 0 || currentLead == 3)) {
      message = currentLead == 2
        ? `The ${getShortName(gameState[gameState.myTeamHomeStatus + 'Team'])} are ${getSynonym('betterThanExpectedSynonym')} ${gameState.dayNight == 'day' ? 'today' : 'this evening'}, up ${gameState[gameState.myTeamHomeStatus + 'Score']}-${gameState[gameState.opponentHomeStatus + 'Score']}`
        : `The ${getShortName(gameState[gameState.myTeamHomeStatus + 'Team'])} ${getSynonym('areKillingItSynonym')} ${gameState.dayNight == 'day' ? 'today' : 'this evening'}, up ${gameState[gameState.myTeamHomeStatus + 'Score']}-${gameState[gameState.opponentHomeStatus + 'Score']}`;
      gameState.currentPost = gameState.awayScore + gameState.homeScore;
      gameState.mediaActive = true;
      gameState.mediaTeam = 'Colorado Rockies';
      gameState.mediaSynonym = 'wentOkSynonym';
      messageArray.push({ text: message, id: gameState.currentPost });
    }
  }

   //COMEBACK - CLAWING BACK

  if (gameState.losingState == 'Losing' && 
      gameState.largestRunDeficit > 1 && 
      (
        // Condition 1: The deficit is now exactly 1
        gameState.currentRunDeficit == 1 || 
        (
          // Condition 2: Existing math (every 2 runs recovered)
          (gameState.largestRunDeficit - gameState.currentRunDeficit) % 2 == 0 &&
          gameState[gameState.myTeamHomeStatus + 'Score'] > previousGameState[gameState.myTeamHomeStatus + 'Score']
        ) ||
        // Condition 3: Scored more than 1 run in a single update
        gameState[gameState.myTeamHomeStatus + 'Score'] - previousGameState[gameState.myTeamHomeStatus + 'Score'] > 1
      )
  ) {
      message = `The Rockies are ${getSynonym('clawingBackSynonym')}, now down ${gameState[gameState.opponentHomeStatus + 'Score']}-${gameState[gameState.myTeamHomeStatus + 'Score']}.`;

      gameState.currentPost = gameState.awayScore + gameState.homeScore;
      gameState.mediaActive = true;
      gameState.mediaTeam = 'Colorado Rockies';
      gameState.mediaSynonym = 'wentOkSynonym';
      messageArray.push({ text: message, id: gameState.currentPost });
  }


   //tacos post
  if (gameState[gameState.myTeamHomeStatus + 'Score'] > 6 && previousGameState[gameState.myTeamHomeStatus + 'Score'] <= 6) {
    message = `taco's`

    //taco's is often a second post
    gameState.currentPost = 'tacos';
    gameState.mediaActive = true;
    gameState.mediaTeam = 'Colorado Rockies';
    gameState.mediaSynonym = 'wentOkSynonym';
    messageArray.push({ text: message, id: gameState.currentPost });
  }  

 
  if ((gameState.detailedState == 'In Progress' || gameState.abstractGameState == 'Live') &&
    (gameState.currentInning == 8 && previousGameState.currentInning == 7)  &&
    gameState[gameState.myTeamHomeStatus + 'Score'] >= gameState[gameState.opponentHomeStatus + 'Score'] ) {

      /*// TODO
      if (gameState[gameState.myTeamHomeStatus + 'Score'] < gameState[gameState.opponentHomeStatus + 'Score']) {
        
        //return
      }
      */

      let message = gameState[gameState.myTeamHomeStatus + 'Score'] > gameState[gameState.opponentHomeStatus + 'Score'] ? 
      `The ${getShortName(gameState[gameState.myTeamHomeStatus + 'Team'])} are NOT losing ${gameState[gameState.myTeamHomeStatus + 'Score']}-${gameState[gameState.opponentHomeStatus + 'Score']} after seven innings. Will they ${getSynonym('pullItOffSynonym')}?` :
      `The ${getShortName(gameState[gameState.myTeamHomeStatus + 'Team'])} are TIED ${gameState[gameState.myTeamHomeStatus + 'Score']}-${gameState[gameState.opponentHomeStatus + 'Score']} after seven innings. Will they ${getSynonym('pullItOffSynonym')}?`

      gameState.currentPost = '7th';

      messageArray.push({ text: message, id: gameState.currentPost });
    }


  if ((gameState.detailedState == 'Game Over' || gameState.detailedState == 'Final') && (previousGameState.detailedState == 'In Progress')) {
    setPostGameTriggers();
    outputFinalScoreInfo(gameState);

    gameState.losingState = gameState[gameState.myTeamHomeStatus + 'Score'] < gameState[gameState.opponentHomeStatus  + 'Score'] ? 'Losing' : 'Not Losing';
    
    if (gameState.losingState == 'Losing') {
      //for streak and records, use previous game state because game state not updated until Final which can take 10+ minutes
      gameState.standings.streakNumber = previousGameState.standings.streakType == 'losses' ? previousGameState.standings.streakNumber + 1 : 1
      let record = `The ${getShortName(gameState[gameState.myTeamHomeStatus + 'Team'])} have lost the game, ${gameState[gameState.opponentHomeStatus + 'Score']}-${gameState[gameState.myTeamHomeStatus + 'Score']}. Their record is now ${gameState.standings.myTeamRecordWins} wins and ${gameState.standings.myTeamRecordLosses + 1} losses${gameState.gameType == 'S' ? ' in spring training.' : '.'}`
      let streak = `The Rockies' losing streak is now at ${gameState.standings.streakNumber} games. ${getSynonym('holdOntoYourButtsSynonym')}`
      let message = gameState.standings.streakNumber > 1 ? record + `

` + streak : record

      gameState = pullMLBStandings(gameState);
      gameState.currentPost = 'gameend';

      messageArray.push({ text: message, id: gameState.currentPost });
      
      
    }
    else {

      if (gameState.currentInning > 8 && (gameState.inningState == 'Bottom' || gameState.inningState == 'End') && gameState.losingState == 'Not Losing' && previousGameState.losingState != 'Not Losing') {
        gameState.walkOff = true;
      }

      gameState.standings.streakNumber = previousGameState.standings.streakType == 'wins' ? previousGameState.standings.streakNumber + 1 : 1
      let record = `The ${getShortName(gameState[gameState.myTeamHomeStatus + 'Team'])} have ${gameState.walkOff == true ? `WALKED OFF the ${gameState[gameState.opponentHomeStatus + 'Team']} for the win` : 'NOT lost the game'}, ${gameState[gameState.myTeamHomeStatus + 'Score']}-${gameState[gameState.opponentHomeStatus + 'Score']}${gameState.largestRunDeficit > 2 ? `, coming back from a ${gameState.largestRunDeficit}-run deficit` : ''}. Their record is now ${gameState.standings.myTeamRecordWins + 1} wins and ${gameState.standings.myTeamRecordLosses} losses${gameState.gameType == 'S' ? ' in spring training.' : '.'}`
      let streak = `The Rockies' current NOT losing streak is at ${gameState.standings.streakNumber} games. ${gameState.standings.streakNumber > 2 ? getSynonym('inShockWinningSynonym') : getSynonym('getSurprisedSynonym')}` 
      let message = gameState.standings.streakNumber > 1 ? record + `

` + streak : record

      gameState = pullMLBStandings(gameState);

      gameState.currentPost = 'gameend';
      gameState.mediaActive = true;
      gameState.mediaTeam = 'Colorado Rockies'; //setMediaTeam(gameState);    
      gameState.mediaSynonym = 'wentOkSynonym';

      messageArray.push({ text: message, id: gameState.currentPost });
      
      
    }
  }

  //if no posts for a while, post a Rockies fun fact
  if (gameState.detailedState == 'In Progress' && previousGameState.lastPostTime != '' && extraPostThreshold(previousGameState.lastPostTime, gameState.gameType == 'S' ? 300 : 21) && gameState.currentInning < 9 && messageArray.length == 0) {
    message = postFunFact(gameState);

    //TODO delete this after testing video
    //gameState.mediaActive = true;
    gameState.currentPost = 'funfact_' + Date.now();
    messageArray.push({ text: message, id: gameState.currentPost });
  }


  if (((gameState.gameDelay[0] == 'delayed start' && previousGameState.gameDelay[0] != 'delayed start') || 
  (gameState.gameDelay[0] == 'delayed' && previousGameState.gameDelay[0] != 'delayed')) &&
  (previousGameState.detailedState == 'Warmup' || previousGameState.detailedState == 'Pre-Game' || previousGameState.detailedState == 'Final' || previousGameState.detailedState == 'In Progress')) {
  //Logger.log(gameState.gameDelay)
  //Logger.log(previousGameState.gameDelay)

  //there's not always a reason given for delay, so this is a catch-all if undefined
  gameState.gameDelay[1] = gameState.gameDelay[1] ?? 'inclement weather or some other reason'

  message = gameState.gameDelay[0] == 'delayed' ? `The Rockies are currently on a delay due to ${gameState.gameDelay[1]}. That is no reason to ${getSynonym('delaySynonym')}.` : `The Rockies are currently on a ${gameState.gameDelay[0]} due to ${gameState.gameDelay[1]}. That is no reason to ${getSynonym('delaySynonym')}.`

    gameState.currentPost ='delayed start';
    messageArray.push({ text: message, id: gameState.currentPost });
    
  }


  if (gameState.detailedState == 'Postponed' && previousGameState.detailedState != 'Postponed') {
  message = `The Rockies game has been postponed. Unfortunately they will have to ${getSynonym('delaySynonym')} until next time.`

    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("GameState");
    let triggerID0 = sheet.getRange(2,3,1,1).getValue();

    if (triggerID0 != undefined && triggerID0 != '') {
      setPostGameTriggers();
    }
    gameState.currentPost = 'postponed';
    messageArray.push({ text: message, id: gameState.currentPost });
  }





  if (messageArray.length > 0) { Logger.log('messageArray=' + JSON.stringify(messageArray) + ' mediaActive in post=' + gameState.mediaActive); }
  return [messageArray, gameState]
}


function pullCurrentSchedule(startDate, endDate) {
  hydrations = '&hydrate=gameInfo,linescore,probablePitcher' //add 'hydrations' to see other possible
  dateRange = `&startDate=${startDate}&endDate=${endDate}`  //&startDate=2025-06-10&endDate=2025-06-10'
  url = 'http://statsapi.mlb.com/api/v1/schedule/games/?sportId=1' + dateRange + hydrations
  
  Logger.log(url)
  
  let response = JSON.parse(UrlFetchApp.fetch(url))//.getContentText();
  schedule = response.dates[0]

  //Logger.log(schedule);

  return schedule;
}

function pullMLBPerson (personLink) {
  url = `http://statsapi.mlb.com${personLink}`
  
  let response = JSON.parse(UrlFetchApp.fetch(url))//.getContentText();
  person = response.people[0]

  Logger.log(person);

  return person;
}


function getShortName(name) {

  switch(name) {
    case 'Boston Red Sox':
      return 'Red Sox';
    case 'Chicago White Sox':
      return 'White Sox';
    case 'Toronto Blue Jays':
      return 'Blue Jays';      
    default:
      var n = name.split(" ");
      return n[n.length - 1];
  }
}


function loadPreviousGameState () {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("GameState");  
  response = sheet.getRange(2,1,1,1).getValues()[0][0];
  previousGameState = JSON.parse(response)
  
  Logger.log('load previousGameState')
  Logger.log(previousGameState)

  return previousGameState;
}

function findCurrentGameState(schedule) {
  
  myTeam = 'Colorado Rockies'
  //myTeam = 'Chicago Cubs'
  //testing
  //schedule = getTestSchedule();
  gameState = {};

  for (let value of schedule.games) {
    //Logger.log(value.teams.home.team.name)
    //Logger.log(value.teams.away.team.name)

    if (value.teams.home.team.name == myTeam || value.teams.away.team.name == myTeam) {
      gameState.detailedState = value.status.detailedState;
      gameState.abstractGameState = value.status.abstractGameState;
      gameState.gamePk = value.gamePk;
      gameState.gameType = value.gameType;
      gameState.currentInning = value.linescore.currentInning;
      gameState.inningState = value.linescore.inningState;

      gameState.dayNight = value.dayNight;
      gameState.myTeamHomeStatus = value.teams.home.team.name == myTeam ? 'home' : 'away'
      gameState.opponentHomeStatus = value.teams.home.team.name == myTeam ? 'away' : 'home'
      gameState.homeTeam = value.teams.home.team.name;
      gameState.awayTeam = value.teams.away.team.name;

      gameState.homeProbablePitcherLink = value.teams.home.probablePitcher.link
      gameState.awayProbablePitcherLink = value.teams.away.probablePitcher.link

      gameState.homeScore = value.teams.home.score;
      gameState.awayScore = value.teams.away.score;
      gameState.homeWins = value.teams.home.leagueRecord.wins;
      gameState.awayWins = value.teams.away.leagueRecord.wins;
      gameState.homeLosses = value.teams.home.leagueRecord.losses;
      gameState.awayLosses = value.teams.away.leagueRecord.losses;
      gameState.homeWinPct = value.teams.home.leagueRecord.pct;
      gameState.awayWinPct = value.teams.away.leagueRecord.pct;     

      gameState.venue = value.venue.name;

      gameState.gamesInSeries = value.gamesInSeries;

      gameState.myTeamWinPercentage = gameState[gameState.myTeamHomeStatus + 'WinPct'] * 100;
      gameState.myTeamWins = gameState[gameState.myTeamHomeStatus + 'Wins'];
      gameState.myTeamLosses = gameState[gameState.myTeamHomeStatus + 'Losses'];

      //currently losing?

      if (gameState[gameState.myTeamHomeStatus + 'Score'] == gameState[gameState.opponentHomeStatus  + 'Score']) {
        gameState.losingState = 'Tied'
      } else {
              gameState.losingState = gameState[gameState.myTeamHomeStatus + 'Score'] < gameState[gameState.opponentHomeStatus  + 'Score']
      ? 'Losing' : 'Not Losing';
      }   



      gameState.gameMediaArrayLength = gameState.gameMediaArrayLength == undefined || !gameState.gameMediaArrayLength || gameState.detailedState == 'Pre-Game' ? 0 : gameState.gameMediaArrayLength;

      gameState.largestRunDeficit = gameState.largestRunDeficit == undefined || !gameState.largestRunDeficit || gameState.detailedState == 'Pre-Game' ? 0 : gameState.largestRunDeficit;
      gameState.currentRunDeficit = gameState.currentRunDeficit == undefined || !gameState.currentRunDeficit || gameState.detailedState == 'Pre-Game' ? 0 : gameState.currentRunDeficit;
      gameState.largestRunLead = gameState.largestRunLead == undefined || !gameState.largestRunLead || gameState.detailedState == 'Pre-Game' ? 0 : gameState.largestRunLead;
      gameState.losingStateChanges = gameState.losingStateChanges == undefined || !gameState.losingStateChanges || gameState.detailedState == 'Pre-Game' ? 0 : gameState.losingStateChanges;
      gameState.winningStateChanges = gameState.winningStateChanges == undefined || !gameState.winningStateChanges || gameState.detailedState == 'Pre-Game' ? 0 : gameState.winningStateChanges;      
      gameState.largeThresholdMet = gameState.largeThresholdMet == undefined || !gameState.losingStateChanges || gameState.detailedState == 'Pre-Game' ? false : gameState.largeThresholdMet;
      gameState.extraLargeThresholdMet = gameState.extralargeThresholdMet == undefined || !gameState.losingStateChanges || gameState.detailedState == 'Pre-Game' ? false : gameState.extraLargeThresholdMet;
      gameState.massiveThresholdMet = gameState.massiveThresholdMet == undefined || !gameState.losingStateChanges || gameState.detailedState == 'Pre-Game' ? false : gameState.massiveThresholdMet;
      gameState.lastPostTime = gameState.lastPostTime == undefined || !gameState.lastPostTime || gameState.detailedState == 'Pre-Game' ? '' : gameState.lastPostTime;

      gameState.walkOff = gameState.walkOff == undefined || !gameState.walkOff || gameState.detailedState == 'Pre-Game' ? false : gameState.walkOff;

      gameState.postHistory = gameState.postHistory == undefined || !gameState.postHistory || gameState.detailedState == 'Pre-Game' ? [0] : gameState.postHistory;  
      gameState.scriptRunHistory = gameState.scriptRunHistory == undefined || !gameState.scriptRunHistory || gameState.detailedState == 'Pre-Game' ? [] : gameState.scriptRunHistory;   

      gameState.gameDelay = gameState.detailedState.split(":").map(function(item) {
        return item.trim().toLowerCase();
      });


      gameState.mediaActive = gameState.mediaActive ?? false

      //if we haven't pulled from standings API
      //gameState.standingsActive = false

      //Logger.log('init losingStateChanges=' + gameState.losingStateChanges)

      //Logger.log(gameState)

      return gameState;
    }
  }
}
