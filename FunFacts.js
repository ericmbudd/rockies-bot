
function postFunFact(gameState, test) {
  gameState = gameState ?? loadPreviousGameState()
  //test ? gameState = testFunFactData() : gameState;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("TeamRecord");  
  teamRecord = sheet.getRange(2,4,1,10).getValues()[0];
  lastPostUsed = teamRecord[0]
  seriesRecord = teamRecord[8].split('-')
  onPaceWins = Math.round(gameState.myTeamWinPercentage / 100 * 162);
  totalGamesSoFar = gameState[gameState.myTeamHomeStatus + 'Wins'] + gameState[gameState.myTeamHomeStatus + 'Losses']
  wins = gameState[gameState.myTeamHomeStatus + 'Wins']
  winsPythagorean = Math.round(gameState.standings.myTeamPythagoreanWinPct * totalGamesSoFar);
  winsPythDifference = winsPythagorean - gameState[gameState.myTeamHomeStatus + 'Wins']

  comparisonText = 'the same number of'
  comparisonText = winsPythDifference < 0 ? 'more' : comparisonText
  comparisonText = winsPythDifference > 0 ? 'fewer' : comparisonText
  

  //which is z fewer/more/the same number of losses than their actual record.

  //Logger.log('teamRecord=' + teamRecord)


  let mostLossesResult = mostLossesMLB(gameState);
  let mostRunDiffResult = mostRunDifferentialMLB(gameState);

  funFactArray = [
    { text: sellTheTeamAlert(test), skip: true },
    { text: gameState.standings.streakType == 'losses' ? `The Rockies' current losing streak is at ${gameState.standings.streakNumber == 1 ? gameState.standings.streakNumber + ' game' : gameState.standings.streakNumber + ' games'}.` : `The Rockies' current NOT losing streak is at ${gameState.standings.streakNumber == 1 ? gameState.standings.streakNumber + ' game' : gameState.standings.streakNumber + ' games'}. ${gameState.standings.streakNumber > 2 ? getSynonym('inShockWinningSynonym', test) : getSynonym('getSurprisedSynonym', test)}`,
      skip: gameState.standings.streakNumber < 2 },
    { text: `The Rockies' current series losing streak is at ${Number(teamRecord[9])} consecutive series during this season.`,
      skip: Number(teamRecord[9]) < 2 },
    { text: mostLossesResult, skip: !mostLossesResult },
    { text: `The Rockies ${gameState.gamesSinceTacos == 1 ? 'last got taco\u2019s just one game ago' : 'haven\u2019t gotten taco\u2019s for ' + gameState.gamesSinceTacos + ' games' }.`,
      skip: gameState[gameState.myTeamHomeStatus + 'Score'] > 6 || gameState.gamesSinceTacos != 0 },
    { text: `Follow the Did The Rockies Lose Starter Pack to get plugged into Rockies baseball on Bluesky: https://go.bsky.app/PoLxduX` },
    { text: sellTheTeamAlert(test), skip: true },
    { text: `Fun Fact: Heading into the current game, the Rockies have scored ${numberWithCommas(Number(teamRecord[1]))} runs while opposing teams have scored ${numberWithCommas(Number(teamRecord[2]))} runs.

That converts to a Pythagorean record of ${winsPythagorean}-${totalGamesSoFar - winsPythagorean}, which is${winsPythDifference == 0 ? '' : ' ' + Math.abs(winsPythDifference)} ${comparisonText} ${Math.abs(winsPythDifference) == 1 ? 'loss' : 'losses'} compared to their actual record.` },
    { text: winningPercentageFunFact(gameState, test) },
    { text: `Fun Fact: The Rockies' record is ${teamRecord[5]} in the last 10 games.` },
    { text: `The Rockies' record against ${gameState.standings.opposingStarterHand}-handed starting pitchers (like today) is ${gameState.standings.myTeamSplitRecords[gameState.standings.opposingStarterHand].wins}-${gameState.standings.myTeamSplitRecords[gameState.standings.opposingStarterHand].losses}.` },
    { text: `Visit our profile on Bluesky to sign up for post notifications from Did The Rockies Lose to ${getSynonym('getGameUpdatesSynonym', test)}` },
    { text: gameState.standings.eliminationNumber === '-' 
      ? `The Rockies are still technically in the hunt for a playoff spot and will have to wait to ${getSynonym('workOnTheirGolfSwingSynonym', test)} until later in the season.`
      : gameState.standings.eliminationNumber > 0 
        ? `The Rockies' elimination number is ${gameState.standings.eliminationNumber}.

    (the number means how many opposing wins / Rockies losses until they are eliminated from the playoffs) and they can ${getSynonym('workOnTheirGolfSwingSynonym', test)} in the offseason.` 
        : `The Rockies have been eliminated from the playoffs.

    They are ready to ${getSynonym('workOnTheirGolfSwingSynonym', test)} in the offseason.` },
    { text: mostRunDiffResult, skip: !mostRunDiffResult },
    //winsLossesUntilRecord(gameState),
    { text: nextSeriesFunFact(test) },
    { text: `The Rockies are on pace to finish the season with ${onPaceWins} wins and ${162 - onPaceWins} losses.` },
    { text: allTeamsRunDifferential(test) },
    { text: `In all of the series that The Rockies have played this season, their record is ${seriesRecord[0]} ${seriesRecord[0] == 1 ? 'win' : 'wins'}, ${seriesRecord[1]} ${seriesRecord[1] == 1 ? 'loss' : 'losses'}, and ${seriesRecord[2]} ${seriesRecord[2] == 1 ? 'tie' : 'ties'}.` },
    { text: `I realize it's ${getSynonym('oldNewsSynonym', test)} but the Colorado Rockies are ranked ${gameState.standings.myTeamSportRank}th out of 30 teams.` },
    { text: `The Rockies are playing against the ${gameState[gameState.opponentHomeStatus + 'Team']} ${gameState.dayNight == 'day' ? 'today' : 'tonight'} and their record against all ${gameState.standings.opposingLeague == 'American League' ? gameState.standings.opposingLeague + ' teams is': gameState.standings.opposingDivision + ' teams is'} ${gameState.standings.opposingDLWins}-${gameState.standings.opposingDLLosses}.` },
    { text: allTeamsRunsAllowed(test) },
    { text: gameState.myTeamHomeStatus == 'home' ? `The Rockies' record is ${teamRecord[6]} when playing at Coors Field in Colorado.` :
    `The Rockies' record is ${teamRecord[7]} when playing at opposing ballparks.` },
    { text: allTeamsRunsScored(test) },
    { text: `Add our Colorado Rockies feed on Bluesky to ${getSynonym('followRockiesFeed', test)}: https://bsky.app/profile/did:plc:dkanfr5ivoi3hat7pz6fjiat/feed/coloradorox` },
    { text: `The Rockies are ${gameState.standings.divisionGamesBack} games back in the ${gameState.standings.myTeamDivision} division.` },
    { text: nlStandingsFunFact(test) }
  ]

  //.toFixed(1).replace(/[.,]0$/, "")

  nextPostToUse = (lastPostUsed + 1) % funFactArray.length 

  Logger.log(`There are a total of ${funFactArray.length} fun facts in the array.`)
  Logger.log(`Using Fun Fact index ${nextPostToUse}.`)

  // skip forward past any posts marked to skip
  let attempts = 0;
  while (funFactArray[nextPostToUse].skip && attempts < funFactArray.length) {
    nextPostToUse = (nextPostToUse + 1) % funFactArray.length;
    attempts++;
  }

  !test && Logger.log(funFactArray[nextPostToUse].text)

  !test && sheet.getRange(2,4,1,1).setValue(nextPostToUse)

  return test ? funFactArray.map(f => f.text) : funFactArray[nextPostToUse].text;
}

function winningPercentageFunFact(gameState, test){
  gameState = gameState ?? loadPreviousGameState()
  value = Math.round(Math.random())

  var message = ''

  if (value > .5) {
    message = `The Rockies have only won ${gameState.myTeamWinPercentage.toFixed(2)}% of their games, which is ${getSynonym('getHowBadSynonym', test)}.`
  }
  else
  {
    message = `The Rockies have only won ${gameState.myTeamWinPercentage.toFixed(2)}% of their games.
    
${getSynonym('notMadJustDisappointedSynonym', test)}`
  }

  //Logger.log(message)

  return message;
}



function allTeamsReturnStat(stat, statName, sortByDirection, test) {
  stats = pullAllTeamStandings(stat, sortByDirection)
  plusSign = stat == 'runDifferential' ? '+' : ''
  message = `MLB ${statName}:
`
  let colRank = null;
  for (let [index, t] of stats.entries()){
    const abbr = teamInfo[t.team.name].abbreviation;
    if (abbr === 'COL') {
      colRank = index + 1;
    }
    message += `${t[stat] > 0 ? plusSign + numberWithCommas(t[stat]) : t[stat] == 0 ? ' ' + numberWithCommas(t[stat]) : numberWithCommas(t[stat])} ${abbr}
`}

  Logger.log(`COL rank for ${statName}: ${colRank} out of ${stats.length}`)

  message += `\n${getRankedSynonym(colRank, stats.length, message, test)}`

  //Logger.log(message)
  return message
}


function getRankedSynonym(rank, total, message, test) {
  const third = Math.ceil(total / 3);
  let synonymKey = 'inARoughSpotSynonym';
  if (rank <= third) synonymKey = 'inAGoodSpotSynonym';
  else if (rank <= third * 2) synonymKey = 'inAMiddleSpotSynonym';

  let synonym = '';
  let fits = false;
  for (let i = 0; i < 5; i++) {
    synonym = getSynonym(synonymKey, test);
    if ((message + `\n${synonym}`).length <= 300) { fits = true; break; }
  }
  if (!fits) {
    const backups = ['Welp.', 'Ok then.', 'Alright.', 'Fair enough.', 'So it goes.', 'Yep.', 'Cool cool.', 'Noted.', 'Indeed.', 'Moving on.'];
    synonym = backups[Math.floor(Math.random() * backups.length)];
  }
  return synonym;
}


function allTeamsRunDifferential(test) {
  return allTeamsReturnStat('runDifferential', 'run differential', 'desc', test)
}

function allTeamsRunsAllowed(test) {
  return allTeamsReturnStat('runsAllowed', 'runs allowed', 'asc', test)
}

function allTeamsRunsScored(test) {
  return allTeamsReturnStat('runsScored', 'runs scored', 'desc', test)
}


function nlStandingsFunFact(test) {
  var _ = LodashGS.load();
  let dateTime = new Date();
  let timezone = Session.getScriptTimeZone();
  let year = Utilities.formatDate(dateTime, timezone, "yyyy")
  url = 'https://statsapi.mlb.com/api/v1/standings?leagueId=104,103&season=' + year + '&standingsTypes=regularSeason&hydrate=hydrations,team,record(division)'
  let response = JSON.parse(UrlFetchApp.fetch(url))
  teamInfo = allTeamInfo()

  const nlDivisionNames = {203: 'NL West', 204: 'NL East', 205: 'NL Central'}
  let divisionLeaders = []
  let otherNLTeams = []

  for (let division of response.records) {
    if (division.league.id !== 104) continue;
    for (let t of division.teamRecords) {
      const abbr = teamInfo[t.team.name].abbreviation;
      const entry = {abbr: abbr, wins: t.wins, losses: t.losses, winPct: parseFloat(t.winningPercentage), divisionName: nlDivisionNames[division.division.id]}
      if (t.divisionRank === '1') {
        divisionLeaders.push(entry)
      } else {
        otherNLTeams.push(entry)
      }
    }
  }

  divisionLeaders = _.orderBy(divisionLeaders, 'winPct', 'desc')
  otherNLTeams = _.orderBy(otherNLTeams, 'winPct', 'desc')

  let wildCard = otherNLTeams.slice(0, 3)
  let rest = otherNLTeams.slice(3)

  let allNLTeams = [...divisionLeaders, ...otherNLTeams]
  let colEntry = allNLTeams.find(t => t.abbr === 'COL')
  let colRank = allNLTeams.sort((a, b) => b.winPct - a.winPct).indexOf(colEntry) + 1

  message = getRankedSynonym(colRank, allNLTeams.length, '', test) + `\n\nNL Division Leaders\n`
  for (let t of divisionLeaders) {
    message += `${t.abbr}: ${t.wins}-${t.losses}\n`
  }
  message += `\nWild Card\n`
  for (let t of wildCard) {
    message += `${t.abbr}: ${t.wins}-${t.losses}\n`
  }
  message += `\n`
  for (let t of rest) {
    message += `${t.abbr}: ${t.wins}-${t.losses}\n`
  }

  return message.trim()
}


function winsLossesUntilRecord(gameState) {
  gameState = gameState ?? loadPreviousGameState()
  onPaceLosses = 162 - (Math.round(gameState.myTeamWinPercentage / 100 * 162))
  onPaceWins = (Math.round(gameState.myTeamWinPercentage / 100 * 162))
  lossesNeeded = 122 - gameState.myTeamLosses
  winsNeeded = 42 - gameState.myTeamWins;
  lossesText = '';

  Logger.log(lossesNeeded)
  Logger.log(winsNeeded)

  if (onPaceLosses > 100 && (lossesNeeded > 0 && winsNeeded > 0)) {
  message = `The Rockies are ${lossesNeeded == 1 ? lossesNeeded + ' loss' : lossesNeeded + ' losses'} away from being the worst team of all time. On the other hand, the Rockies are only ${winsNeeded == 1 ? winsNeeded + ' win' : winsNeeded + ' wins'} away from NOT being the worst team of all time.`
  }
  else if (lossesNeeded <= 0) {
    message = `The Rockies are the worst team of all time with ${gameState.myTeamLosses} losses.`
  }
  else {
    message = `The Rockies are NOT the worst team of all time and have managed to not-lose ${gameState.myTeamWins} games.`
  }  

  return message;
}


function sellTheTeamAlert(test){
  message = `Rockies ${getSynonym('newsAlertSynonym', test)}: ${getSynonym('sellTheTeamSynonym', test)}`

  return message;
}


function mostLossesMLB(gameState) {
  gameState = gameState ?? loadPreviousGameState()
  onPaceLosses = 162 - (Math.round(gameState.myTeamWinPercentage / 100 * 162))
  lossesText = '';
  let dateTime = new Date();
  let timezone = Session.getScriptTimeZone();  
  let year = Utilities.formatDate(dateTime, timezone, "yyyy")  

  if (onPaceLosses > 121) {
      lossesText = 'the most'
  } else if (onPaceLosses == 121) {
      lossesText = 'tied for the most'
  } else if (onPaceLosses == 120) {
      lossesText = 'tied for second most'
  } else if (onPaceLosses == 119) {
      lossesText = 'tied for third most'
  } else if (onPaceLosses == 118) {
      lossesText = 'the fifth most'
  } else if (onPaceLosses == 117) {
      lossesText = 'tied for fifth most'
  } else if (onPaceLosses == 116) {
      lossesText = 'the sixth most'
  } else if (onPaceLosses == 115) {  
      lossesText = 'tied for sixth most'            
  } else if (onPaceLosses < 115 && onPaceLosses >= 100) {  
      lossesText = 'NOT one of the top most';       
  } else if (onPaceLosses < 100) {  
      return '';    
  }

  message = `The Rockies are on pace to have ${onPaceLosses} losses in ${year}, ${lossesText} losses in modern MLB history.

The top 7:
121 losses (2024 White Sox)
120 losses (1962 Mets)
119 losses (2025 Rockies)
119 losses (2003 Tigers)
117 losses (1916 Athletics) 
115 losses (2015 Orioles)
115 losses (1935 Braves)`

  return message;
}

function mostRunDifferentialMLB(gameState) {
  gameState = gameState ?? loadPreviousGameState()

  runDifferential = gameState.standings.myTeamRunsScored - gameState.standings.myTeamRunsAllowed;
  Logger.log(runDifferential)
  onPaceRunDifferential = (Math.round(runDifferential * (162 / gameState.standings.myTeamGamesPlayed)))
  lossesText = '';
  let dateTime = new Date();
  let timezone = Session.getScriptTimeZone();  
  let year = Utilities.formatDate(dateTime, timezone, "yyyy")  

  if (onPaceRunDifferential < -345) {
      lossesText = 'the most'
  } else if (onPaceRunDifferential == -345) {
      lossesText = 'tied for the most'
  } else if (onPaceRunDifferential < -339) {
      lossesText = 'the second most'    
  } else if (onPaceRunDifferential == -339) {
      lossesText = 'tied for second most'
  } else if (onPaceRunDifferential < -337) {
      lossesText = 'the third most'      
  } else if (onPaceRunDifferential == -337) {
      lossesText = 'tied for third most'
  } else if (onPaceRunDifferential < -333) {
      lossesText = 'the fourth most'    
  } else if (onPaceRunDifferential == -333) {
      lossesText = 'tied fourth most'
  } else if (onPaceRunDifferential > -333 && onPaceRunDifferential <= -300) {  
      lossesText = 'NOT one of the top most';       
  } else if (onPaceRunDifferential > -300) {  
      return '';    
  }

  message = `The Rockies have a season run differential of ${runDifferential}, on pace for ${onPaceRunDifferential} in ${year}, ${lossesText} negative in modern MLB history (since 1901).

Here are the top 5:
-345 (1932 Red Sox)
-339 (2023 Athletics)
-337 (2003 Tigers)
-333 (2019 Tigers)
-333 (1954 Athletics)
… -306 (2024 White Sox)`

  return message;
}

function nextSeriesFunFact(test) {
  test = undefined
  nextSeriesArray = nextSeriesSchedule();

  message = `Here are the Colorado Rockies’ upcoming series:`

  for (let series of nextSeriesArray){
    message += `
${series.shortDate} Rockies ${series.myTeam == 'home' ? 'vs.' : '@'} ${series[series.opposingTeam + 'Team']} (${series[series.opposingTeam + 'Pct'] > .48 ? getSynonym('goingToHurtSynonym', test) : getSynonym('youNeverKnowSynonym', test)})`
  }

  //Logger.log(message)
  return message;

}



function gamesSinceTacos() {
  schedule = pullFullSchedule()

  var date = new Date();
  var timezone = Session.getScriptTimeZone();
  date = Utilities.formatDate(date, timezone, "yyyy-MM-dd");  

  tacosGameDate = ''
  tacosGameIndex = 0;

  todayGameDate = date
  todayGameIndex = 0;

  for(let [index, g ] of schedule.entries()) {
    if (g[g.myTeam + 'Score'] > 6) {
      tacosGame = g.officialDate;
      tacosGameIndex = index;
    }

    if (g.officialDate == todayGameDate) {
      todayGameIndex = index;
    }

/*
    if (g.officialDate == '2025-08-14' || g.officialDate == '2025-08-15' || g.officialDate == '2025-08-16') {
      Logger.log(g)
    }
*/    
  }

  let gamesWithoutTacosArray = schedule.slice(tacosGameIndex, todayGameIndex)
  let gamesWithoutTacosCount = tacosGameIndex == 0 ? 0 : gamesWithoutTacosArray.length
  Logger.log('gamesWithoutTacosArray')
  Logger.log(gamesWithoutTacosArray)
  Logger.log(tacosGame) 
  Logger.log(gamesWithoutTacosCount)

//.officialDate = '2025-08-15'
  //Logger.log(schedule)

  return gamesWithoutTacosCount

}





















