const mqtt = require('mqtt')
const timeScheduleWater = [6,16]
const MINPERML = 1
var mysql     = require('mysql'),
    jsontools = require( 'json-tools' ),
    json      = require("json-toolkit"),
     db = require("./db"),
    fs        = 	require('fs'),
    sanitize = require("sanitize-filename");
var water = null,
   _plants = null,
   _plantDB = null;
	JSONR = json.Resource;
// var options = {
//     port: 1883,
//     clientId: 'server' + Math.random().toString(16).substr(2, 8),
//     username: 'pi',
//     password: 'root',
//     keepalive: 60,
//     // reconnectPeriod: 1000,
//     // protocolId: 'MQIsdp',
//     // protocolVersion: 3,
//     // clean: true,
//     encoding: 'utf8'
// };
var options = {
    port: 16108,
    clientId: 'server' + Math.random().toString(16).substr(2, 8),
    username: 'test',
    password: '123',
    keepalive: 60,
    // reconnectPeriod: 1000,
    // protocolId: 'MQIsdp',
    // protocolVersion: 3,
    // clean: true,
    encoding: 'utf8'
};
var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  port: "3306",
  database: "ocs",
  typeCast: function castField( field, useDefaultTypeCasting ) {

        // We only want to cast bit fields that have a single-bit in them. If the field
        // has more than one bit, then we cannot assume it is supposed to be a Boolean.
        if ( ( field.type === "TINYINT" ) && ( field.length === 1 ) ) {

            return (field.string() == '1');

        }

        return( useDefaultTypeCasting() );

    }
});
// var jsontool = require("json-toolkit"),
// 	JSONR = jsontool.Resource;
//  const client = mqtt.connect('tcp://192.168.43.108',options)
  const client = mqtt.connect('tcp://m12.cloudmqtt.com',options)

/**
 * The state of the garage, defaults to closed
 * Possible states : closed, opening, open, closing
 */
var state = 'closed'


///connect sql
con.connect();

function task(name,content,time) {
    this.taskName = name
    this.taskContent =content
    this.taskTime = time
}

function newTask(name,content,callback){
    return callback(new task(name,content,Date.now()))
}
client.on('connect', () => {
  client.subscribe('Client/Task')
  client.subscribe('Device/Sensor/+')
  // client.subscribe('Server/Water/+')
  // // client.subscribe('Server/Water/+')
  client.subscribe('#')

  // Inform controllers that garage is connected
  client.publish('Server/Conected', 'true')
 // sendStateUpdate()
})

client.on('error', function(){
    console.log("Can't connect to MQTT")
    client.end()
})

client.on('message', (topic, message) => {
// console.log('received message %s %s', topic, message)
 
  switch (topic) {
    case 'Client/Task':
      return handleClientTaskRequest(message.toString())
    case (topic.match(/Device\/Sensor/g)?topic:undefined):

      return handleDeviceRequest(topic,message.toString())
    case "Server/Water/1":
    case "Server/Water/2":
      return console.log(topic+"+"+message.toString())
    // case 'garage/close':
    //   return handleCloseRequest(message)
  }
})

function sendStateUpdate () {
  console.log('sending state %s', state)
  //client.publish('garage/state', state)
}


// function alarm(){
//  // if() ///set thoi gian cu the
//   waterAuto()
// }

// setInterval(alarm,15000)
function handleClientTaskRequest (message) {
    console.log('Handle Client Task Request')
    if(message == "Sync"){
         getPlantDB()
         getGardenMensures()
         return
    }
    if(message == "" || message == null) return
    // if(!json.parse(message))
    //     return
    var task = json.parse(message)
    console.log(task.taskName)
        switch(task.taskName){
            case "Garden/Add":
                return addGarden(task.taskContent)
            case "Sync":
              backuptoFile()

                  getPlantDB()
                  getGardenMensures()
                 break
            // case "PlantDB/Update":
            //     return getPlantDB()
            case "Garden/Delete":
                return deleteGarden(task.taskContent)
            case (task.taskName.match(/Water\//g)?task.taskName:undefined):
                 return handleWater(task.taskName,task.taskContent)
                 
            case (task.taskName.match(/Temp\//g)?task.taskName:undefined):
                 return handleTemp(task.taskName,task.taskContent)
                 
            case (task.taskName.match(/Light\//g)?task.taskName:undefined):
                 return handleLight(task.taskName,task.taskContent)
            case "Plant/Add":
                return addPlant(task.taskContent)
            case "Plant/Delete":
                return deletePlant(task.taskContent)
            case "Garden/Delete":
                return deleteGarden(task.taskContent)     
            case "Garden/Sync":
                syncGarden(task.taskContent)
                break    
            default:
                
                break
            
        }
        
  
}

function convertJson(converter) {
    ///remove escape characters from mysql and convert to json
    return json.stringify(converter).replace(/\\"/g, '"').replace(/\"\[/g,"\[").replace(/\]\"/g,"\]")
    
}
function deletePlant(content){
    readPlantData()/// doc file

}

function addGarden(content){
  console.log("AddGarden")
  //console.log(content)
  //var json = content.toObject()
  console.log(content)
  var job = new JSONR(content,{
      from_file:false
  })
    //var values = []
  //  for(var i in content){
   //      values.push([content[0].name,JSON.stringify(content[0].plantids),JSON.stringify(content[0].measures)])
  //  }
   //console.log(values)
   content = JSON.parse(content)
   var id = content.id
    con.query("SELECT id FROM Garden WHERE id = "+mysql.escape(id), function (err, result, fields) {
            if (err) throw err
            if(result == null) return
        var name = content.name
        var ids = JSON.stringify(content.plantIds)
        var men = JSON.stringify(content.measures)
      var values = [[id,name,ids,men]]
        var sql = "INSERT INTO Garden (id,name, plantids,measures) VALUES ?";
        con.query(sql,[values], function (err, result) {
          if (err) throw err;
          console.log("Insert Garden ID " + id,"Done")
          console.log(result.affectedRows+" record inserted");
        });
              });
}



function deleteGarden(content){
    //var values = []
  //  for(var i in content){
   //      values.push([content[0].name,JSON.stringify(content[0].plantids),JSON.stringify(content[0].measures)])
  //  }
   //console.log(values)
   content = JSON.parse(content)
   var id = content
//   var gardens = job.toObject()
//   console.log(gardens)
//   for(var i in gardens){
      
//   }
//   console.log(content)
  var sql = "DELETE FROM Garden WHERE id = "+ mysql.escape(id);
  con.query(sql, function (err, result) {
    if (err) throw err;
     console.log("Delete Garden " + id,"Done")
    console.log(result.affectedRows+" record deleted");
  });

}
function getPlantDB(){
    console.log('Get all plantDB')
    // con.query("SELECT * FROM PlantDB", function (err, result, fields) {
    //         if (err) throw err;
    //         // var data = JSON.parse(JSON.parse(result).data);
    //         // console.log(data);
    //         newTask("PlantDB/Update", result, function(newtask) {
    //             client.publish("Server/Task",convertJson(newtask))
    //         });
    //     });

    fs.readFile('./data/plantDB.json', function (err, data) {
      if (err || data == null || data == "")
        console.log("No plantDB")
      else {
        newTask("PlantDB/Update", JSON.parse(data), function(newtask) {
          console.log(convertJson(newtask))
                 client.publish("Server/Task",convertJson(newtask))
        });
        // tokenDevice = rememberTokenDevice.slice(0);
      }
    });

}
function handleTemp(topic,content){
  console.log("handleTemp")
  var garden = topic.split("/")
  var care = JSON.parse(content)
  var status = care.status
  var start_time = care.time
  if(status == "On") status = 1
  else status = 0
  var values = [["Temp",garden[1],start_time,status]]
  var sql = "INSERT INTO Care (action,gardenID,start_time,status) VALUES ?";
    con.query(sql,[values], function (err, result) {
      if (err) throw err;
       console.log("Insert Temp","Done")
      console.log(result.affectedRows+" record inserted");
    });

  db.run(`INSERT INTO Care (action,gardenID,start_time,status) VALUES(?,?,?,?)`, ["Temp",garden[1],start_time,status], function(err) {
    if (err) {
      return console.log(err.message);
    }
    // get the last insert id
    console.log(`A row has been inserted to Care with rowid ${this.lastID}`);
  });
   //db.close()
  // if(content == "ON"){
  //   client.publish("Server/Temp/"+garden[1],"ON")
  // }else{
  //    client.publish("Server/Temp/"+garden[1],"OFF")

  //}
  
}
function handleLight(topic,content){
  console.log("handleTemp")
  console.log(content)
    var garden = topic.split("/")
    var care = JSON.parse(content)
    var status = care.status
    var start_time = care.time
    if(status == "Off") status = 1
    else status = 0
    var values = [["Light",garden[1],start_time,status]]
    var sql = "INSERT INTO Care (action,gardenID,start_time,status) VALUES ?";
    con.query(sql,[values], function (err, result) {
      if (err) throw err;
      console.log("Insert Light","Done")
      console.log(result.affectedRows+" record inserted");
    });
    db.run(`INSERT INTO Care (action,gardenID,start_time,status) VALUES(?,?,?,?)`, ["Light",garden[1],start_time,status], function(err) {
    if (err) {
      return console.log(err.message);
    }
    // get the last insert id
    console.log(`A row has been inserted to Care with rowid ${this.lastID}`);
  });
  //db.close()
  // if(content == "ON"){
  //   client.publish("Server/Light/"+garden[1],"ON")
  // }else{
  //    client.publish("Server/Light/"+garden[1],"OFF")

  // }
  
}
function addPlant(content){
  console.log("addPlant")
   // if(content.length >1){
        fs.writeFile('./data/plants.json', content);
    //}
}
function syncGarden(content){
  console.log("SyncGarden")
  var gardens = JSON.parse(content)
  for (var i in gardens) {
  //  var garden = [[,gardens[i].plantids,gardens[i].id]]
   // console.log(garden)
    var sql = "UPDATE Garden SET name=?,plantids=?,humidity=?,temperature=?,light=? WHERE id = ?";
      con.query(sql,[gardens[i].name,JSON.stringify(gardens[i].plantIds), gardens[i].humidity, gardens[i].temperature, gardens[i].light,gardens[i].id], function (err, result) {
        if (err) throw err;
         console.log("Update all Garden","Done")
        console.log(result.affectedRows+" record updated");
      });
  }
  // var garden = topic.split('/')
  // var old_measures;
  // var sql = "SELECT measures FROM Garden WHERE id = " +garden[2];
  // con.query(sql, function (err, result) {
  //   if (err) throw err;

  //    old_measures = result[0].measures
  //    var input = content.split("-")
  //     var time = Date.now()
  //     var measure = {
  //         temp: input[0],
  //         humidity: input[1],
  //         time: time
  //     }
  //     var new_measures = []
  //     if(old_measures !=null){
  //       new_measures = JSON.parse(old_measures)
  //     }
  //     new_measures.push(measure)
  //     new_measures = convertJson(new_measures)
  //      //console.log(new_measures)
  //     var sql = "UPDATE Garden SET measures = ? WHERE id = " + mysql.escape(garden[2]);
  //     con.query(sql,[new_measures], function (err, result) {
  //       if (err) throw err;
  //       client.publish("Update","Done")
  //       console.log(result.affectedRows+" record updated");
  //     });
  // });
  
}


function handleDeviceRequest(topic,content){
  console.log("deviceRequest")
  //console.log(content)
  //var json = content.toObject()
  //console.log(topic)
  //console.log(content)
  backuptoFile()
  var garden = topic.split('/')
  var old_measures;
  var sql = "SELECT measures FROM Garden WHERE id = " +garden[2];
  con.query(sql, function (err, result) {
    if (err) throw err;

     old_measures = result[0].measures
     var input = content.split("-")
      var time = Date.now()
      var measure = {
          temp: input[0],
          humidity: input[1],
          light: input[2],
          time: time
      }
      var new_measures = []
      if(old_measures !=null && old_measures !=""){
        new_measures = JSON.parse(old_measures)
      }
      new_measures.push(measure)
      new_measures = convertJson(new_measures)
       //console.log(new_measures)
      var sql = "UPDATE Garden SET measures = ? WHERE id = " + mysql.escape(garden[2]);
      con.query(sql,[new_measures], function (err, result) {
        if (err) throw err;
         console.log("Update Measure garden" + garden[2],"Done")
        console.log(result.affectedRows+" record updated");
      });
  });
  
}
function backuptoFile(){
  console.log("backup")
  fs.readFile('./data/config', function (err, data) {
		if (err || data == ""){
        var d = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
        //ghi ngay ngay mai
				fs.writeFile('./data/config',d.getDate());
          
		}else {
      var now = new Date()
      console.log(data + " " + now.getDate())
      if(data == now.getDate()){ /// qua ngay moi
        console.log("backuptofile")
          con.query("SELECT id, name,measures FROM Garden", function (err, result, fields) {
            if (err) throw err;
            result.forEach(function(garden) {
                var dir = "./data/"
                var yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
                var folder = yesterday.getDate()+""+(yesterday.getMonth()+1)+""+yesterday.getFullYear()
                var filename = garden.id +"_"+sanitize(garden.name)
                if (!fs.existsSync(dir+folder)){
                    fs.mkdirSync(dir+folder);
                }
                //ghi ra file
                // console.log(garden)
                fs.writeFile('./data/'+folder+"/"+garden.id +"_" + sanitize(garden.name),convertJson(garden),"utf8");
                //xoa measure trong db
                  var sql = "UPDATE Garden SET measures = ? WHERE id = "+ mysql.escape(garden.id);
                  con.query(sql,[null], function (err, result) {
                    if (err) throw err;
                    console.log(result.affectedRows+" record deleted");
                  });
          }, this);
            
            
              console.log("Backup garden to file")

          });
          //ghi lai ngay moi
          var d = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
          fs.writeFile('./data/config',d.getDate());
      }
		}
	});
}

function getGardenMensures(){
    console.log('Get garden measures')
    con.query("SELECT id,measures FROM Garden", function (err, result, fields) {
            if (err) throw err;

            newTask("Garden/Update", result, function(newtask) {
                client.publish("Server/Task",convertJson(newtask))
            });
        });
}

function handleWater(name, content){
  console.log("Water")
 // fs.writeFile('./data/water.json', content);
var gardenId = name.split('/')
var water = JSON.parse(content)
var amount = water.amount
var start_time = water.date
var end_time;
console.log(water.amount + "a " + water.time)
var notes = water.notes
if(water.amount != null || water.time != null){
console.log(values)
  if(water.time != null) end_time  = start_time + water.time * 60*1000
  var values = [[gardenId[1],amount,start_time,0]]
  var sql = "INSERT INTO Water (gardenID,amount,time,status) VALUES ?";
  con.query(sql,[values], function (err, result) {
    if (err) throw err;
     console.log("Insert Water","Done")
    console.log(result.affectedRows+" record inserted");
  });
  var values = [["Water",gardenId[1],amount,start_time,end_time,0]]
  var sql = "INSERT INTO Care (action,gardenID,amount,start_time,end_time,status) VALUES ?";
  con.query(sql,[values], function (err, result) {
    if (err) throw err;
     console.log("Insert Water","Done")
    console.log(result.affectedRows+" record inserted");
  });

  db.run(`INSERT INTO Care (action,gardenID,amount,start_time,end_time,status) VALUES(?,?,?,?,?,?)`, ["Water",gardenId[1],amount,start_time,end_time,0], function(err) {
    if (err) {
      return console.log(err.message);
    }
    // get the last insert id
    console.log(`A row has been inserted to Care with rowid ${this.lastID}`);
  });
  //db.close()
}
//client.publish("Server/Task",convertJson(newtask))

}
// function handleCloseRequest (message) {
//   if (state !== 'closed' && state !== 'closing') {
//     state = 'closing'
//     sendStateUpdate()

//     // simulate door closed after 5 seconds (would be listening to hardware)
//     setTimeout(() => {
//       state = 'closed'
//       sendStateUpdate()
//     }, 5000)
//   }
// }

/**
 * Want to notify controller that garage is disconnected before shutting down
 */
function handleAppExit (options, err) {
  if (err) {
    console.log(err.stack)
  }

  if (options.cleanup) {
    // client.publish('garage/connected', 'false')
  }

  if (options.exit) {
    process.exit()
  }
}
fs.readFile('./data/water.json', function (err, data) {
	if (err)
		saveWaterSchedule();
	else {
    if(data == null || data == "") return;
		water = JSON.parse(data);
		// tokenDevice = rememberTokenDevice.slice(0);
	}
});
function saveWaterSchedule(schedule) {
	schedule = schedule || water;
	fs.writeFile('./data/water.json', JSON.stringify(schedule));
}


function readPlantData(){
  fs.readFile('./data/plants.json', 'utf8', function (err, data) {
    //console.log(JSON.parse(data))
	if (err || data == null || data == ""){
		console.log("No plant")
    _plants =  null
  }
	else {
		_plants =  JSON.parse(data)
		// tokenDevice = rememberTokenDevice.slice(0);
	}
  });
}

function readPlantDBData(){
  fs.readFile('./data/plantDB.json', 'utf8', function (err, data) {
    //console.log(JSON.parse(data))
	if (err || data == null || data == ""){
		console.log("No plantDB")
    _plantDB =  null
  }
	else {
		_plantDB =  JSON.parse(data)
		// tokenDevice = rememberTokenDevice.slice(0);
	}
  });
}

///Manual water schedule
function waterAuto() {
  console.log("Auto")
    //do Stuff here   12h50
    var date = new Date
    console.log(date.getHours())
    // if(timeScheduleWater.indexOf(date.getHours()) >-1 && date.getMinutes()<10){ ///dieu kien sai  // trung h && phút <10
    //if(true){ ///dieu kien sai  // trung h && phút <10

   con.query("SELECT * FROM Garden", function (err, result, fields) {
            if (err) throw err;
            
            for(var i in result){
              var garden = result[i]
          // //   var a = JSON.stringify(garden.measures)
            //  console.log("Time: "+ Array.isArray(a))
            // console.log(garden)
               if(garden.measures == null || garden.measures == "") return
             //  console.log("A")
              var last_measure = JSON.parse(garden.measures)
              if(last_measure == null || last_measure =="") 
                  continue
              last_measure = last_measure[last_measure.length-1]
              var gardenHumid = null
              var gardenTemp = null
              var gardenLight = null
              if(garden.humidity !=null && garden.humidity != "") gardenHumid = garden.humidity.split("-")
              if(garden.temperature !=null && garden.temperature != "")  gardenTemp = garden.temperature.split("-")
              if(garden.light !=null && garden.light != "")  gardenLight = garden.light.split("-")

             // console.log(last_measure)
              var plantids =JSON.parse(garden.plantids)
              //console.log(plantids)
              if(plantids == null || plantids =="") 
                  continue
              readPlantData()
              var plants = _plants
              if(plants == null || plants =="") 
                  continue
             // console.log(plants)
              if(plants.length >0){
                      // for(var j in plantids){
                      //   var plant = plants.find(o => o.id == plantids[j])
                      // }
              var plant = plants.find(o => o.id == plantids[0])  ///lay plant dau tien trong garden
              if (plant == null) continue
              readPlantDBData()
              var plantDBs = _plantDB
              if(plantDBs == null || plantDBs =="") 
                  continue
              var plantDB = plantDBs.find(o=>o.id == plant.plantDBId)
            //  console.log(plantDB.measures[0])
              var measures = plantDB.measures
            //  console.log("Plant"+plant.actions)
             getPlantStage(plant.actions,function(stage){
                  var measure = measures.find(o => o.stage == stage.newStage)
                  var temp = measure.temp.split("-")
                var humid = measure.humid.split("-")
                 var light = measure.light.split("-")

                var minTemp = temp[0]
                var maxTemp = temp[1]
                var minHumid = humid[0]
                var maxHumid = humid[1]
                var minLight = light[0]
                var maxLight = light[1]
                if(gardenHumid != null && gardenHumid[0] != "") minHumid = gardenHumid[0]
                if(gardenHumid != null && gardenHumid[1] != "") maxHumid = gardenHumid[1]
                if(gardenTemp != null && gardenTemp[0] != "") minTemp = gardenTemp[0]
                if(gardenTemp != null && gardenTemp[1] != "") maxTemp = gardenTemp[1]
                if(gardenLight != null && gardenLight[0] != "") minLight = gardenLight[0]
                if(gardenLight != null && gardenLight[1] != "") maxLight = gardenLight[1]

                console.log("Temp: " + minTemp +" "+ maxTemp)///temp cay
                console.log("Humid: "+minHumid+ " " + maxHumid)//humid cay
                console.log("Light: " +minLight + " " + maxLight)//humid cay
                console.log("realTemp:" + last_measure.temp)
                console.log("realHumid:" + last_measure.humid)
                console.log("realLight:" + last_measure.light)
                last_measure.light = last_measure.light == null ? 0 :last_measure.light
                //water
                if(last_measure.humid < minHumid){ //tuoi khi <min
                    client.publish("Server/Water/"+garden.id,"ON")
                    console.log("Garden"+garden.id+"Water ON")
                }
                if (last_measure.humid>maxHumid) {  //tuoi den khi > max // || last_measure.humidity >= humid[0]
                    client.publish("Server/Water/"+garden.id,"OFF")
                    console.log("Garden"+garden.id+"Water OFF")
                }
                //light
                if(last_measure.light < minLight){ //tuoi khi <min
                    client.publish("Server/Light/"+garden.id,"ON")
                    console.log("Garden"+garden.id+"Light ON")
                }
                if (last_measure.light>maxLight) {  //tuoi den khi > max // || last_measure.humidity >= humid[0]
                    client.publish("Server/Light/"+garden.id,"OFF")
                    console.log("Garden"+garden.id+"Light OFF")
                } 
                //temp
                if(last_measure.temp < minTemp){ //tuoi khi <min
                    client.publish("Server/Temp/"+garden.id,"ON")
                    console.log("Garden"+garden.id+"Temp ON")
                }
                if (last_measure.temp>maxTemp) {  //tuoi den khi > max // || last_measure.humidity >= humid[0]
                    client.publish("Server/Temp/"+garden.id,"OFF")
                    console.log("Garden"+garden.id+"Temp Off")
                }     

                console.log("Water auto")

                  // console.log(measure)
              })
            }
          }
          
        });
  //  }

}
setInterval(waterManual, 10000);
setInterval(waterAuto, 1000*300);

// function waterManual() {
//     //do Stuff here
//     var time = Date.now()
  
 
// con.query("SELECT * FROM Care WHERE status = 0 OR status = 1", function (err, result, fields) {
//             if (err) throw err;
//             for(var i in result){
//               var water = result[i]
//               console.log("Time: "+ time)
//               if(((water.action == "Temp" || water.action == "Light") && water.start_time <= time) || (water.status == 0 && water.start_time <= time) || (water.status == 1 && water.end_time<=time)){
//                 console.log("Water "+water.gardenID+water.amount+"status:" + water.status)
//                 new_endtime = Date.now()
//                 new_status = 0
//                 switch(water.action){
//                   case "Water":
//                       console.log("water nha")
//                       switch(water.status){
//                         case 0:
//                           if(water.amount !=null) new_endtime = Date.now()+ water.amount*MINPERML /// tinh toan thoi gian tat dua tren amount
//                           else new_endtime = water.end_time
//                           new_status = 1   //da tuoi nhung chua tat
//                           client.publish("Server/Water/"+water.gardenID,"ON")
//                           break
//                         case 1:
//                           new_endtime = water.end_time /// lay tgian cu
//                           new_status = 2 /// da tat nuoc
//                           client.publish("Server/Water/"+water.gardenID,"OFF")
//                           break
//                         // case 2:
//                         //   break
//                       }
//                       break
//                   case "Temp":
//                         console.log("Temp nha")
//                         switch(water.status){
//                           case 0:
//                             new_status = 2   //da lam
//                             client.publish("Server/Temp/"+water.gardenID,"ON")
//                             break
//                           case 1:
//                             new_status = 2 //da lam
//                             client.publish("Server/Temp/"+water.gardenID,"OFF")
//                             break
//                           // case 2:
//                           //   break
//                         }
                       

//                       break
//                   case "Light":
//                         console.log("Light nha")
//                         switch(water.status){
//                           case 0:
//                             new_status = 2  //da lam
//                             client.publish("Server/Light/"+water.gardenID,"ON")
//                             break
//                           case 1:
//                             new_status = 2 //da lam
//                             client.publish("Server/Light/"+water.gardenID,"OFF")
//                             break
//                           // case 2:
//                           //   break
//                         }

//                       break
//                 }
//                 ///da tuoi nhung chua tat
//                   var sql = "UPDATE Care SET end_time =  ?,status = ? WHERE id = " + mysql.escape(water.id);
//                       con.query(sql,[new_endtime,new_status], function (err, result) {
//                         if (err) throw err;
//                         client.publish("Water manual","Done")
//                         console.log(result.affectedRows+" record updated");
//                       });

                  
//               }
//             }
//         });


// }

function waterManual() {
    //do Stuff here
    var time = Date.now()
  
 db.serialize(() => {
  // queries will execute in serialized mode
  db.serialize(() => {
    // queries will execute in serialized mode
        let sql = `SELECT * FROM Care WHERE status = 0 OR status = 1`;
      
      db.each(sql, (err, row) => {
            if (err) throw err;
           // for(var i in row){
              var water = row
              console.log(row)
            //  console.log("Time: "+ time)
              if(((water.action == "Temp" || water.action == "Light") && water.start_time <= time) || (water.status == 0 && water.start_time <= time) || (water.status == 1 && water.end_time<=time)){
             //   console.log("Water "+water.gardenID+water.amount+"status:" + water.status)
                new_endtime = Date.now()
                new_status = 0
                switch(water.action){
                  case "Water":
                      console.log("water nha")
                      switch(water.status){
                        case 0:
                          if(water.amount !=null) new_endtime = Date.now()+ water.amount*MINPERML /// tinh toan thoi gian tat dua tren amount
                          else new_endtime = water.end_time
                          new_status = 1   //da tuoi nhung chua tat
                          client.publish("Server/Water/"+water.gardenID,"ON")
                          break
                        case 1:
                          new_endtime = water.end_time /// lay tgian cu
                          new_status = 2 /// da tat nuoc
                          client.publish("Server/Water/"+water.gardenID,"OFF")
                          break
                        // case 2:
                        //   break
                      }
                      break
                  case "Temp":
                        console.log("Temp nha")
                        switch(water.status){
                          case 0:
                            new_status = 2   //da lam
                            client.publish("Server/Temp/"+water.gardenID,"ON")
                            break
                          case 1:
                            new_status = 2 //da lam
                            client.publish("Server/Temp/"+water.gardenID,"OFF")
                            break
                          // case 2:
                          //   break
                        }
                       

                      break
                  case "Light":
                        console.log("Light nha")
                        switch(water.status){
                          case 0:
                            new_status = 2  //da lam
                            client.publish("Server/Light/"+water.gardenID,"ON")
                            break
                          case 1:
                            new_status = 2 //da lam
                            client.publish("Server/Light/"+water.gardenID,"OFF")
                            break
                          // case 2:
                          //   break
                        }

                      break
                }
                ///da tuoi nhung chua tat
                  var sql = "UPDATE Care SET end_time =  ?,status = ? WHERE id = " + mysql.escape(water.id);
                      db.run(sql,[new_endtime,new_status], function (err, result) {
                        if (err) throw err;
                        client.publish("Water manual","Done")
                     //   console.log(result.affectedRows+" record updated");
                      });

                  
              }
            //}
        });
});
  // queries will execute in serialized mode
});

}

function calWaterTime(amount){
    return amount * MINPERML*60*1000;
}


function getPlantStage(action,cb){

  for(var index = action.length-1; index>=0;index--){
    if(action[index].type == "StageChange"){
     // console.log(action[index])
    return cb(action[index])
    }
  }
  return cb(null)
}

/**
 * Handle the different ways an application can shutdown
 */
process.on('exit', handleAppExit.bind(null, {
  cleanup: true
}))
process.on('SIGINT', handleAppExit.bind(null, {
  exit: true
}))
process.on('uncaughtException', handleAppExit.bind(null, {
  exit: true
}))

console.log("Server started")