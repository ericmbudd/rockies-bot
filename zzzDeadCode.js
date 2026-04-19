


function normalRun () {
  if (downTime() == true) {
    return;
  }
  main();

}



function downTime() {
  let dateTime = new Date();
  let hour = dateTime.getHours()
  let minutes = dateTime.getMinutes()  

  //Logger.log(hour)
  //Logger.log(hour > 0 && hour < 10)
  return hour > 2 && hour < 10 || minutes % 2 == 1
}
