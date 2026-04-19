function getFeedGenerator(feedURI) {
  const loadedData = loadData();
  const accessJwt = loadedData.accessJwt;

  //hardcoded hack
  feedURI = 'at://did:plc:dkanfr5ivoi3hat7pz6fjiat/app.bsky.feed.generator/coloradorox'
  //feedURI = 'at://did:plc:dkanfr5ivoi3hat7pz6fjiat/app.bsky.feed.generator/playoffmlb'
  const url = 'https://bsky.social/xrpc/app.bsky.feed.getFeedGenerator?feed=' + encodeURIComponent(feedURI);

  const options = {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + accessJwt
    }
  };

  const response = UrlFetchApp.fetch(url, options);
  Logger.log(response)
  return JSON.parse(response.getContentText());
}




function loadData() {
  const url = 'https://bsky.social/xrpc/com.atproto.server.createSession';

  const data = {
    'identifier': 'didtherockieslose.com', //'TestBotEricmbudd',
    'password': 'afnv-trwh-e6gx-o7cc'
  };

  const options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    'payload': JSON.stringify(data),
  };

  const response = UrlFetchApp.fetch(url, options);
  return JSON.parse(response.getContentText());
}

function getUrlInfo(url) {
  var content

  try {
    content = UrlFetchApp.fetch(url).getContentText();
  } catch (error) {
    //error on HTTP / 404 etc
    Logger.log('getUrlInfo')
    Logger.log(error)
    return;
    // Expected output: ReferenceError: nonExistentFunction is not defined
    // (Note: the exact output may be browser-dependent)
  }


  //cheeriogs https://github.com/tani/cheeriogs
  //cheerio tester https://scrapeninja.net/cheerio-sandbox/basic
  const $ = Cheerio.load(content);

  var imageUrl = $('meta[property="og:image"]').attr('content');
  if (imageUrl === undefined)
   { imageUrl = $('meta[name="twitter:image"]').attr('content'); }
  if (imageUrl === undefined)
   { imageUrl = $('.wp-block-image img').attr('src'); }
  if (imageUrl === undefined)
   { imageUrl = 'https://www.mlbstatic.com/mlb.com/images/logos/apple-touch-icons-180x180/mlb.png'}



  //Logger.log("imageUrl=" + imageUrl)

  var title = $('title').text();
  var description = $('meta[name="description"]').attr('content');

  //Logger.log('description 1')
  //Logger.log(description)

  if (description === undefined)
   { description = $('meta[property="og:description"]').attr('content'); }
  if (description === undefined)
   { description = $('meta[name="twitter:title"]').attr('content'); }
  if (description === undefined)
   { description = $('title').text().trim(); }


  //Logger.log('description 2')
  //Logger.log(description)

  //why did I do this? maybe to keep from blowing up if not present in JSON property
  //if ( imageUrl === undefined)
  //  imageUrl = url

  return {
    'title': title,
    'description': description,
    'imageUrl': imageUrl
  }
}

function createFile(data) {
  var blob = Utilities.newBlob(data, 'application/png', 'tempBluesky.png');
  var dir = DriveApp.getFoldersByName('BlueskyImages').next();
  var doc = dir.createFile(blob);

  var id = doc.getId();

  return id
  //Logger.log(id)
  //DriveApp.getFileById(id.getId()).setTrashed(true);
}

function getImageAndShrink(imageUrl) {
  //var imageUrl = 'https://newspack-coloradosun.s3.amazonaws.com/wp-content/uploads/2023/09/sanford-smith-candlewyck-os-1.png'
  //Logger.log('getImageAndShrinkURL=' + imageUrl)
  
  try {
    var blobLarge = UrlFetchApp.fetch(imageUrl).getBlob().getBytes();  // added .getBytes()
  } catch (error) {
    Logger.log('createFile 1')
    Logger.log(error);
    var blobLarge = null
  }

  if (blobLarge === null)
    return null

  //Logger.log('blobLarge=' + blobLarge)
  blobLargeID = createFile(blobLarge)

  var width = 400; // Please set the size of width with the unit of pixels.
  var outputFilename = "tempBluesky3.png"; // Please set the output filename.

  try {
    var blob1 = UrlFetchApp.fetch(imageUrl).getBlob().setName("sampleImage_temporal");
  } catch (error) {
    Logger.log('createFile 2')
    Logger.log(error);
    var blob1 = null
  }

  var dir = DriveApp.getFoldersByName('BlueskyImages').next();
  var fileId = dir.createFile(blob1).getId();
  var link = Drive.Files.get(fileId).thumbnailLink.replace(/\=s.+/, "=s" + width);
  var blob2 = UrlFetchApp.fetch(link).getBlob().setName(outputFilename);
  //var file = DriveApp.createFile(blob2);
  Drive.Files.remove(fileId);
  Drive.Files.remove(blobLargeID);


  return blob2;
}


function uploadForImageLink(imageUrl) {
  const loadedData = loadData();
  const accessJwt = loadedData.accessJwt;
  var blob = getImageAndShrink(imageUrl);

  Logger.log(imageUrl)

  const options = {
    'method': 'post',
    'headers': {
    'Authorization': 'Bearer ' + accessJwt
    },
    ...(blob != null && {'payload': blob.getBytes()}),
  };

  const url = 'https://bsky.social/xrpc/com.atproto.repo.uploadBlob';

//Logger.log(options)


  const response = UrlFetchApp.fetch(url, options);
  //Logger.log("uploadForImageLink response=" + response)

  return JSON.parse(response.getContentText());
}

//mimeType
//video/x-m4v
//video/mp4

function uploadVideoSimple(blob) {
  const loadedData = loadData();
  const accessJwt = loadedData.accessJwt;
  const options = {
    'method': 'post',
    'headers': {
    'Authorization': 'Bearer ' + accessJwt,
    'Content-Type': 'video/x-m4v'
    },
    'payload': blob
    } 

  const url = 'https://bsky.social/xrpc/com.atproto.repo.uploadBlob';

  const response = UrlFetchApp.fetch(url, options);
  Logger.log("uploadVideoSimple response=" + response)

  return JSON.parse(response.getContentText());
}

function uploadVideoRecommended(blob, mimeType = 'video/mp4') {
  const loadedData = loadData();
  const accessJwt = loadedData.accessJwt;
  const did = loadedData.did;
  const didDoc = loadedData.didDoc;

  // Extract PDS endpoint from didDoc to dynamically form the PDS DID
  let pdsDid = '';
  if (didDoc && didDoc.service) {
    const pdsService = didDoc.service.find(s => s.id === '#atproto_pds');
    if (pdsService && pdsService.serviceEndpoint) {
      pdsDid = pdsService.serviceEndpoint.replace('https://', 'did:web:').replace('http://', 'did:web:');
    }
  }
  if (!pdsDid) throw new Error("Could not determine PDS DID from session.");

  const exp = Math.floor(Date.now() / 1000) + (60 * 30); // 30 minutes

  // 1. Get service auth token for the video service (upload)
  const uploadAuthUrl = 'https://bsky.social/xrpc/com.atproto.server.getServiceAuth?aud=' + encodeURIComponent(pdsDid) + '&lxm=com.atproto.repo.uploadBlob&exp=' + exp;
  const authOptions = {
    'method': 'get',
    'headers': {
      'Authorization': 'Bearer ' + accessJwt
    }
  };
  const uploadAuthResponse = JSON.parse(UrlFetchApp.fetch(uploadAuthUrl, authOptions).getContentText());
  const uploadVideoToken = uploadAuthResponse.token;

  // 2. Upload the video directly to the Bluesky video service
  const uploadUrl = 'https://video.bsky.app/xrpc/app.bsky.video.uploadVideo?did=' + encodeURIComponent(did) + '&name=video.mp4';
  const uploadOptions = {
    'method': 'post',
    'headers': {
      'Authorization': 'Bearer ' + uploadVideoToken,
      'Content-Type': mimeType
    },
    'payload': blob,
    'muteHttpExceptions': true
  };
  
  const uploadResponseRaw = UrlFetchApp.fetch(uploadUrl, uploadOptions);
  const uploadResponse = JSON.parse(uploadResponseRaw.getContentText());
  const responseCode = uploadResponseRaw.getResponseCode();
  
  if (responseCode !== 200 && responseCode !== 409) {
    throw new Error("Video upload failed: " + uploadResponseRaw.getContentText());
  }
  
  const jobId = uploadResponse.jobId;

  Logger.log("Video uploaded to video.bsky.app. Job ID: " + jobId + (responseCode === 409 ? " (Already processed)" : ""));

  // 3. Get service auth token for the video service (status polling)
  const statusAuthUrl = 'https://bsky.social/xrpc/com.atproto.server.getServiceAuth?aud=' + encodeURIComponent(pdsDid) + '&lxm=app.bsky.video.getJobStatus&exp=' + exp;
  const statusAuthResponse = JSON.parse(UrlFetchApp.fetch(statusAuthUrl, authOptions).getContentText());
  const statusVideoToken = statusAuthResponse.token;

  // 4. Poll for job completion
  const statusUrl = 'https://video.bsky.app/xrpc/app.bsky.video.getJobStatus?jobId=' + encodeURIComponent(jobId);
  const statusOptions = {
    'method': 'get',
    'headers': {
      'Authorization': 'Bearer ' + statusVideoToken
    }
  };

  let jobState = '';
  let retries = 0;
  while (jobState !== 'JOB_STATE_COMPLETED' && retries < 30) {
    Utilities.sleep(3000); // Wait 3 seconds before each poll
    const statusResponse = JSON.parse(UrlFetchApp.fetch(statusUrl, statusOptions).getContentText());
    const jobStatus = statusResponse.jobStatus;
    jobState = jobStatus.state;

    Logger.log("Video processing state: " + jobState + " (" + (jobStatus.progress || 0) + "%)");

    if (jobState === 'JOB_STATE_FAILED') {
      throw new Error("Video processing failed: " + jobStatus.error);
    } else if (jobState === 'JOB_STATE_COMPLETED') {
      Logger.log("Video processing complete.");
      return { blob: jobStatus.blob };
    }
    retries++;
  }

  throw new Error("Video processing timed out.");
}


function createThumb(imageUrl) {
  //imageUrl = 'https://newspack-coloradosun.s3.amazonaws.com/wp-content/uploads/2023/09/sanford-smith-candlewyck-os-1.png'
  //Logger.log('thumb url = ' + imageUrl)
  
  const imageData = uploadForImageLink(imageUrl);

  const cid = imageData.blob.ref.$link;
  const mimeType = imageData.blob.mimeType;


  const thumb = imageData["blob"]

  //Logger.log('thumb data = ' + thumb)

/*
  const thumb = {
    '$type': 'blob',
    'ref': {
      '$link': "'" + cid + "'"
    },
    'mimeType': mimeType
  };
*/
  return thumb;
}


function createRecord(text, url, title, description, thumb, linkUrl, urlLocStart, urlLocEnd, feed) {
if (urlLocStart != -1)
  text = text.substring(0, urlLocStart).trim()

  var record = {
    'text': text,
    'createdAt': (new Date()).toISOString(),

  }

  if (thumb != undefined ) {
    record['embed'] =  {
      '$type': 'app.bsky.embed.external',
      'external': {
        'uri': url,
        'title': title,
        'description': description,
        'thumb': thumb
      }
    }
  }

  if (feed != undefined ) {
    record['embed'] =  {
      '$type': 'app.bsky.embed.record',
      'record': {
        'uri': feed.view.uri,
        'cid': feed.view.cid
      }
    }
  }

//  if (url.search('http') != -1 ) {
//    record['embed']['external']['uri'] = url
//  }


  //hashtag support
  var tagLocStart = text.search('#');

  if (tagLocStart > -1)
  {  
  var tagLocEnd = text.substring(tagLocStart).search(' ')

  if (tagLocEnd === -1) {
    var tag = text.substring(tagLocStart)
    tagLocEnd = text.length - tagLocStart;
  }
  else {
    var tag = text.substring(tagLocStart, tagLocStart + tagLocEnd)
  }

  //go through array of various characters that break index to count them
  var utf8CharacterArray = ["•","…","’", "—", "“", "”", "á", "é", "í", "ü", "&nbsp;", "\
\
"];
  var addToIndexCount = 0;

  for (i=0; i < text.length; i++) {

    for (j=0; j < utf8CharacterArray.length; j++) {
      if (text[i] === utf8CharacterArray[j]) {
        addToIndexCount = addToIndexCount + 2
      }    
    }
  }

  //Logger.log('addToIndexCount=' + addToIndexCount)  

  //Logger.log("Tag start and end=" + tagLocStart + " "  + tagLocEnd)
  //Logger.log(tag)


    var urlFacet = 
      [
        {
          'index': {
            'byteStart': addToIndexCount + tagLocStart,
            'byteEnd': addToIndexCount + tagLocStart + tagLocEnd
          },
          'features': [
            {
              $type: 'app.bsky.richtext.facet#tag',
              tag: tag.replace(/^#/, ''),
            }
          ]
        }
      ]
    record ['facets'] = urlFacet
    //Logger.log(record)
  }

/*
  if (urlLocEnd >= 299) {
    text = text.substring(0, 299)
    urlLocEnd = 299
    record['text'] = text
  }
*/

  //go through array of various characters that break index to count them
  var utf8CharacterArray = ["•","…","’", "—", "–", "“", "”", "á", "é", "í", "ü", " \
\
"];
  var addToIndexCount = 0;

  for (i=0; i < text.length; i++) {

    for (j=0; j < utf8CharacterArray.length; j++) {
      if (text[i] === utf8CharacterArray[j]) {
        addToIndexCount = addToIndexCount + 2
        //Logger.log(utf8CharacterArray[j])
      }    
    }
  }

  text = text + '…'

  //Logger.log('addToIndexCount=' + addToIndexCount) 

  //Logger.log("URL start and end=" + urlLocStart + " " + urlLocEnd)

  if (linkUrl != '' && urlLocStart > -1)
  {
    var urlFacet = 
      [
        {
          'index': {
            'byteStart': addToIndexCount + urlLocStart,
            'byteEnd': addToIndexCount + urlLocStart + urlLocEnd
          },
          'features': [
            {
              '$type': 'app.bsky.richtext.facet#link',
              'uri': linkUrl
            }
          ]
        }
      ]
    record ['facets'] = urlFacet
    //Logger.log(record)
  }





  return record;
}


function createImageRecord(text, altText, imageData, linkUrl, urlLocStart, urlLocEnd, pInfo) {
  //Logger.log(imageData.blob)
  //Logger.log(imageData.blob['ref']['$link'])

  if (urlLocEnd == 299) {
    text = text.substring(0, 299)
  }

  textShort = text.length > 299 ? text.substring(0,299) : text

  var record =
  {
    'text': textShort,
    'createdAt': (new Date()).toISOString(),
    'embed': {
      '$type': 'app.bsky.embed.images',
      'images': [{
        'alt': altText,
        'image': imageData.blob,
        'aspectRatio': {
            'width': pInfo.imageWidth,
            'height': pInfo.imageHeight
        }
      }]
    }
  }

  //go through array of various characters that break index to count them
  var utf8CharacterArray = ["•","…","’", "—", "–", "“", "”", "á", "é", "í", "ü", "\
\
"];
  var addToIndexCount = 0;

  for (i=0; i < text.length; i++) {

    for (j=0; j < utf8CharacterArray.length; j++) {
      if (text[i] === utf8CharacterArray[j]) {
        addToIndexCount = addToIndexCount + 2
        //Logger.log(utf8CharacterArray[j])
      }    
    }
  }

  text = text + '…'

  //Logger.log('addToIndexCount=' + addToIndexCount) 



  //Logger.log("URL start and end=" + urlLocStart + " " + urlLocEnd)

  var byteEnd = addToIndexCount + urlLocStart + urlLocEnd > 299 ? 299 : addToIndexCount + urlLocStart + urlLocEnd

  if (linkUrl != '' && urlLocStart > -1)
  {
    var urlFacet = 
      [
        {
          'index': {
            'byteStart': addToIndexCount + urlLocStart,
            'byteEnd': byteEnd
          },
          'features': [
            {
              '$type': 'app.bsky.richtext.facet#link',
              'uri': linkUrl
            }
          ]
        }
      ]
    record ['facets'] = urlFacet
    //Logger.log(record)
  }

  return record;
}



function post(record, root, parent) {
  const loadedData = loadData();
  const accessJwt = loadedData.accessJwt;
  const did = loadedData.did;

  const url = 'https://bsky.social/xrpc/com.atproto.repo.createRecord';

  if (root && parent) {
    record.reply = {}
    record.reply.root = root
    record.reply.parent = parent
  }  

  Logger.log(record)

  const data = {
    'repo': did,
    'collection': 'app.bsky.feed.post',
    'record': record
  };

  const options = {
    'method': 'post',
    'headers': {
      'Authorization': 'Bearer ' + accessJwt,
      'Content-Type': 'application/json; charset=UTF-8'
    },
    'payload': JSON.stringify(data),
  };


  try {
    const response = UrlFetchApp.fetch(url, options);
    //Logger.log(response.getContentText())
    responseParsed = JSON.parse(response.getContentText())
    var uri = responseParsed['uri']
    var cid = responseParsed['cid']

    //let uriStub = JSON.parse(response.getContentText())['uri']
    postIdentifier = uri.substring(uri.lastIndexOf('/') + 1)

    blueskyLink = 'https://bsky.app/profile/didtherockieslose.bsky.social/post/' + postIdentifier
    Logger.log("Bluesky post URL: " + blueskyLink)
  } catch (error) {
    Logger.log('call post API')
    Logger.log(error);

    blueskyLink = 'Error = ' + error
    // Expected output: ReferenceError: nonExistentFunction is not defined
    // (Note: the exact output may be browser-dependent)
  }

  
  return [blueskyLink, uri, cid];
  
  //return responseJSON = JSON.parse(response.getContentText());
}

function testResponseParse () {

  //let uriStub = JSON.parse(response.getContentText())['uri']
  uriStub = "at://did:plc:ayzj7c2kut7sck73jpavn77g/app.bsky.feed.post/3lewooyh5wi25"
  postIdentifier = uriStub.substring(uriStub.lastIndexOf('/') + 1)
  //Logger.log(postIdentifier)

  blueskyLink = 'https://bsky.app/profile/boulderprogressives.org/post/' + postIdentifier

}


function postUrl(url, text, altText, linkUrl, urlLocStart, urlLocEnd, root, parent) {
  //Logger.log("url=" + url)
  url = url.search('http') != -1 ?  url : undefined
  const urlInfo = url && getUrlInfo(url)
  title = ''
  description = ''
  if (urlInfo != undefined ) {
    var thumb = createThumb(urlInfo.imageUrl);
    title = urlInfo.title
    description = urlInfo.description
  }

  if (linkUrl.search('/feed/') != -1) {
    var feed = getFeedGenerator(linkUrl)
  }

  
  //Logger.log('thumb=' + thumb['cid'] + ' ' + thumb['mimeType'])
  //Logger.log("urlInfo")
  //Logger.log(urlInfo)
  const record = createRecord(text, url, title, description, thumb, linkUrl, urlLocStart, urlLocEnd, feed)

  let [blueskyLink, uri, cid] = post(record, root, parent);
  return [blueskyLink, uri, cid];
}


function postBluesky(postText, root, parent) {
  Logger.log('Start Bluesky')
  Logger.log(postText)
  textPlusURL = ''
  //var account = 'boulderprogress';

  //always take top / first tweet to post (ordered by least recently used)
  var tweetText = postText; //postInfo.postsArray[postInfo.singleTweetIndex][1];
  var imageUrl = undefined //postInfo.postsArray[postInfo.singleTweetIndex][2];
  var altText = undefined //postInfo.postsArray[postInfo.singleTweetIndex][3];


  //const text = 'Testing a Bluesky bot';
  //const url = 'https://bouldercoloradovoterguide.com/';

  //address 404 error - use for testing:
  //https://bizwest.com/2023/10/04/tayer-in-season-of-change-whats-your-test/


  //var textPlusURL = '"The Boulder City Council on Thursday unanimously approved a long-term planning document that will guide redevelopment for an area of the city east of 30th Street known as Boulder Junction." #boulder https://boulderreportinglab.org/2023/09/22/more-housing-is-planned-for-boulder-junction-neighborhood-east-of-downtown/'

  var urlLocStart = tweetText.search('https:');
  if (urlLocStart == -1 )
    urlLocStart = tweetText.search('http:');

  if (tweetText.substring(urlLocStart).search('https:') == -1)
    urlLocEnd = tweetText.length
  else
    urlLocEnd = urlLocStart + tweetText.substring(urlLocStart).search('[\n\r\s]+')

  //Logger.log('urlLocStart=' + urlLocStart)
  //Logger.log('urlLocEnd=' + urlLocEnd)
  
  var text = tweetText
  var linkUrl = tweetText.substring(urlLocStart, tweetText.length).trim()
  //Logger.log(text)
  //Logger.log(linkUrl)

  //Logger.log('imageUrl=' + imageUrl)

  if (imageUrl == '' || imageUrl == undefined)
    {
      [blueskyLink, uri, cid] = postUrl(linkUrl, text, altText, linkUrl, urlLocStart, urlLocEnd, root, parent);
    }
  else
    {
      //postUrl(imageUrl, text, altText);
      imageData = undefined// uploadImage(imageUrl)
      record = createImageRecord(tweetText, altText, imageData, linkUrl, urlLocStart, urlLocEnd, pInfo)
      //Logger.log(record)
      [blueskyLink, uri, cid] = post(record, root, parent);
    }

    return [blueskyLink, uri, cid];
}


function uploadImage(imageUrl) {
  const loadedData = loadData();
  const accessJwt = loadedData.accessJwt;
  var blob = getImage(imageUrl);

  const options = {
    'method': 'post',
    'headers': {
    'Authorization': 'Bearer ' + accessJwt
    },
    'payload': blob.getBytes(),
  };

  const url = 'https://bsky.social/xrpc/com.atproto.repo.uploadBlob';

  const response = UrlFetchApp.fetch(url, options);
  //Logger.log("UploadImage response=" + response)
  //Logger.log("UploadImage response.getContentText=" + JSON.parse(response.getContentText()))
  return JSON.parse(response.getContentText());
}

function getImage(imageUrl) {
  //var imageUrl = 'https://newspack-coloradosun.s3.amazonaws.com/wp-content/uploads/2023/09/sanford-smith-candlewyck-os-1.png'
  //Logger.log('getImage=' + imageUrl)
  
  try {
    var blob = UrlFetchApp.fetch(imageUrl).getBlob();
  } catch (error) {
    Logger.log('getImage')
    Logger.log(error);
    var blob = null
  }
  

  return blob
  //return blobSmall;
}
