function playoffMain() {
  var playoffState = playoffSchedule();

  Logger.log(JSON.stringify(playoffState))

  if (playoffState == undefined) {
    playoffState = {};
    playoffState.detailedState = 'Not Scheduled'
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PlayoffState");  
    sheet.getRange(2,1,1,1).setValues([[JSON.stringify(playoffState)]]);    
    Logger.log('no game found today')
    return
  }



  postArray = []



  //postArray = ['test post 1']

  //check for duplicate posts, otherwise post. Only check if making a single post this run
  //sometimes taco's et al have legit reasons to double post


  previousPlayoffState = loadPreviousPlayoffState();


  var activeGame = determinePlayoffPost(playoffState, previousPlayoffState)

  if (activeGame != false ) {
    Logger.log("previousPlayoffState=" + previousPlayoffState[activeGame])
    postArray = playoffGameStartPost(playoffState, previousPlayoffState, activeGame)

    Logger.log("Post=" + postArray)
    postArray.forEach((element) => playoffState = recordPlayoffPost(element, playoffState, false, activeGame));
  }


  /*
  "lastPostParentUri": "at://did:plc:dkanfr5ivoi3hat7pz6fjiat/app.bsky.feed.post/3lzwgndhkcg2o",
  "lastPostParentCid": "bafyreihsy6dmnrjr37vbxjxdxf2n3t2lda7eyn3aziiz36zvnnwwn6u2he",
  */

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PlayoffState");  
  sheet.getRange(2,1,1,1).setValues([[JSON.stringify(playoffState)]]);

}

function playoffReset() {
  var playoffState = playoffSchedule();
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PlayoffState");  
  sheet.getRange(2,1,1,1).setValues([[JSON.stringify(playoffState)]]);  
}

function playoffGameStartPost(playoffState, previousPlayoffState, aG) {
  postArray = []
  // In Progress  Pre-Game



  Logger.log(playoffState[aG])

  

  if (playoffState[aG].detailedState == 'In Progress' && (previousPlayoffState[aG].detailedState == 'Pre-Game' || previousPlayoffState[aG].detailedState == 'Warmup' || previousPlayoffState[aG].detailedState.search('Delayed Start') != -1 )) {

/*
Playoff Update: The NL Wild Card 'A' Game 1 has started between the Cincinnati Reds and the Los Angeles Dodgers at Dodger Stadium.
  If not game one:
    The X are leading the series X-Y
    The series is tied X-X.
*/

    seriesStatus = ``

    if (playoffState[aG].seriesGameNumber == 1) {
      seriesStatus = ``
    }
    else if (playoffState[aG].homeWins > playoffState[aG].awayWins) {
      seriesStatus = ` The ${playoffState[aG].homeTeam} are leading the series ${playoffState[aG].homeWins}-${playoffState[aG].awayWins}.`
    }
    else if (playoffState[aG].homeWins < playoffState[aG].awayWins) {
      seriesStatus = ` The ${playoffState[aG].awayTeam} are leading the series ${playoffState[aG].awayWins}-${playoffState[aG].homeWins}.`
    }
    else {
      seriesStatus = ` The series is tied ${playoffState[aG].awayWins}-${playoffState[aG].homeWins}.`
    }


    message = `MLB Playoff Update: ${aG} has started between the ${playoffState[aG].awayTeam} and the ${playoffState[aG].homeTeam} at ${playoffState[aG].venue}.${seriesStatus}
    
Catch the play-by-play live on MLB Gameday: https://www.mlb.com/gameday/${playoffState[aG].gamePk}`
  
    postArray.push(message)
  }


  test = 0  
  if (postArray.length > 0) {
    message = `While the Rockies have begun to ${getSynonym('workOnTheirGolfSwingSynonym', test)} in the offseason, add our MLB Playoffs feed on Bluesky to ${getSynonym('goodBaseballTeamsSynonym', test)}: https://bsky.app/profile/did:plc:dkanfr5ivoi3hat7pz6fjiat/feed/playoffmlb`,

    postArray.push(message)
  }



/*
    message = `The ${getShortName(gameState[gameState.myTeamHomeStatus + 'Team'])} (${gameState[gameState.myTeamHomeStatus + 'Wins']}-${gameState[gameState.myTeamHomeStatus + 'Losses']}) have started playing ${gameState.myTeamHomeStatus == 'away' ? 'at the' : 'the'} ${gameState[gameState.opponentHomeStatus + 'Team']} (${gameState[gameState.opponentHomeStatus + 'Wins']}-${gameState[gameState.opponentHomeStatus + 'Losses']})${gameState.myTeamHomeStatus == 'home' ? ' at Coors Field' : ''}.
    
Catch the play-by-play live on MLB Gameday: https://www.mlb.com/gameday/${gameState.gamePk}`
*/

  return postArray

}


function determinePlayoffPost(playoffState, previousPlayoffState) {
  previousPlayoffState = previousPlayoffState ?? loadPreviousPlayoffState();


  var activeGame = false

  for (const [key, value] of Object.entries(playoffState)) {
    Logger.log(`${key}: ${value.detailedState}`);
    Logger.log(previousPlayoffState[key].detailedState)
    if (value.detailedState == 'In Progress' && value.detailedState != previousPlayoffState[key].detailedState) {
      Logger.log('activeGame in loop')
      activeGame = key;
      break;
    }
    Logger.log('loop')
  }

  Logger.log('Active Game=' + activeGame)
  return activeGame;
}



function loadPreviousPlayoffState() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PlayoffState");  
  response = sheet.getRange(2,1,1,1).getValues()[0][0];
  previousPlayoffState = JSON.parse(response)
  
  Logger.log('loadPreviousPlayoffState')
  Logger.log(previousPlayoffState)

  return previousPlayoffState;
}


function playoffSchedule() {
  //get script start datetime
  var timezone = Session.getScriptTimeZone();
  var dateTime = new Date();
  var scheduleDate = Utilities.formatDate(dateTime, timezone, "yyyy-MM-dd");  
  //scheduleDate = '2025-09-30'
  playoffState = {}

  teamSchedule = pullCurrentSchedule(scheduleDate, scheduleDate);

  //teamSchedule = getPlayoffSchedule()
  //var gameState = findCurrentGameState(teamSchedule);

  Logger.log(teamSchedule)

  if (teamSchedule == undefined) {
    return
  }

  games = teamSchedule.games

  for (let g of games) {
    Logger.log(g.description)
    playoffState[g.description] = {}

    playoffState[g.description].playoffGame = g.description
    playoffState[g.description].seriesDescription = g.seriesDescription
    playoffState[g.description].seriesGameNumber = g.seriesGameNumber
    playoffState[g.description].gamesInSeries = g.gamesInSeries
    playoffState[g.description].venue = g.venue.name
    playoffState[g.description].gamePk = g.gamePk

    playoffState[g.description].abstractGameState = g.status.abstractGameState
    playoffState[g.description].detailedState = g.status.detailedState

    
    
    playoffState[g.description].homeTeam = g.teams.home.team.name
    playoffState[g.description].awayTeam = g.teams.away.team.name

    playoffState[g.description].homeWins = g.teams.home.leagueRecord.wins
    playoffState[g.description].awayWins = g.teams.away.leagueRecord.wins
  }

  Logger.log(playoffState)

  return playoffState

}








function buildAllFeedTerms() {
  //terms = [['a'], ['b']]
  terms = []
  teams = playoffTeams()
  

  Logger.log(allTeamInfo())

  terms = terms.concat(teamTerms())
  terms = terms.concat(teamByTeamCombinations('teamName', 'teamName'))
  terms = terms.concat(teamByTeamCombinations('abbreviation', 'teamName'))
  terms = terms.concat(teamByTeamCombinations('locationName', 'teamName'))
  terms = terms.concat(teamByTeamCombinations('abbreviation', 'abbreviation'))
  terms = terms.concat(teamByTeamCombinations('abbreviation', 'abbreviation', 1))

  Logger.log(terms)


  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Playoff Terms");  
  sheet.getRange(2,1,terms.length,1).setValues(terms);
}

function teamByTeamCombinations(field1, field2, hashtag) {
  terms = []
  for (let teamA of teams) {
    for (let teamB of teams) {
      if (teamA != teamB) {
        hashtag == 1 ? terms.push([`#${allTeamInfo()[teamA][field1]}vs${allTeamInfo()[teamB][field2]}`])
        : terms.push([`${allTeamInfo()[teamA][field1]} + ${allTeamInfo()[teamB][field2]}`])
      }
    }
  }

  return terms;
}

function teamTerms() {
  terms = []
  teams = playoffTeams()

  for (let team of teams) {
    terms.push([team])
  }

  for (let team of teams) {
    terms.push(['#' + allTeamInfo()[team].teamName.replace(' ', '')])
  }  

  for (let team of teams) {
    terms.push([allTeamInfo()[team].venue.name])
  }  


  return terms;

}

function playoffTeams() {
  teams = [
  'Chicago Cubs',
  'San Diego Padres',
  'Los Angeles Dodgers',
  'Milwaukee Brewers',
  'Philadelphia Phillies',
  'Cincinnati Reds',
  'Toronto Blue Jays',
  'Seattle Mariners',
  'New York Yankees',
  'Cleveland Guardians',
  'Detroit Tigers',
  'Boston Red Sox'
  ]


/*
'Arizona Diamondbacks'
'Atlanta Braves'
'Baltimore Orioles'
'Chicago White Sox'
'Cincinnati Reds'
'Houston Astros'
'Kansas City Royals'
'Los Angeles Angels'
'Miami Marlins'
'Minnesota Twins'
'New York Mets'
'Pittsburgh Pirates'
'San Francisco Giants'
'St. Louis Cardinals'
'Tampa Bay Rays'
'Texas Rangers'
'Washington Nationals'
*/

return teams;

}


function getAllPlayoffRosters(){

  teams = playoffTeams()
  rosters = []

  for (let team of teams) {
    teamRoster = pull40ManRoster(team, minors = 0)
    Utilities.sleep(500)
    //rosters.push(teamRoster)
    rosters = rosters.concat(teamRoster)
    Logger.log(allTeamInfo()[team].id)
  }

  Logger.log(rosters)

  outputPlayoffs40ManRoster(rosters)
  //allTeamInfo()

}