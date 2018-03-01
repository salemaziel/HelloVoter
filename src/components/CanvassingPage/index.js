import React, { PureComponent } from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
  Linking,
  ScrollView,
  PermissionsAndroid,
  Platform,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  DeviceEventEmitter,
  Dimensions,
} from 'react-native';

import { NavigationActions } from 'react-navigation'
import { Dropbox } from 'dropbox';
import DeviceInfo from 'react-native-device-info';
import storage from 'react-native-storage-wrapper';
import Icon from 'react-native-vector-icons/FontAwesome';
import Permissions from 'react-native-permissions';
import RNGLocation from 'react-native-google-location';
import RNGooglePlaces from 'react-native-google-places';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import encoding from 'encoding';
import { _doGeocode } from '../../common';
import DropboxSharePage from '../DropboxSharePage';
import Modal from 'react-native-simple-modal';


export default class App extends PureComponent {

  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      exportRunning: false,
      syncRunning: false,
      serviceError: null,
      locationAccess: null,
      myPosition: null,
      inputPosition: null,
      inputAddress: null,
      cStreet: null,
      cUnit: null,
      cCity: null,
      cState: null,
      cZip: null,
      myPins: { pins: [], last_synced: 0 },
      asyncStorageKey: 'OV_CANVASS_PINS@'+props.navigation.state.params.form.id,
      DisclosureKey : 'OV_DISCLOUSER',
      isModalVisible: false,
      isKnockMenuVisible: false,
      showDisclosure: "true",
      DropboxShareScreen: false,
      dbx: props.navigation.state.params.dbx,
      form: props.navigation.state.params.form,
      user: props.navigation.state.params.user,
    };

  }

  onLocationChange (e: Event) {
    let { myPosition } = this.state;
    myPosition = {
      latitude: e.Latitude,
      longitude: e.Longitude,
    };
    this.setState({ myPosition });
    var LL = {
      lat: e.Latitude,
      lng: e.Longitude,
    };
  }

  requestLocationPermission = async () => {
    
    access = false;

    try {
      res = await Permissions.request('location');
      if (res === "authorized") access = true;
    } catch(error) {
      // nothing we can do about it
    }

    if (access === true) {
      if (Platform.OS === 'android') {
        if (!this.evEmitter) {
          if (RNGLocation.available() === false) {
            this.setState({ serviceError: true });
          } else {
            this.evEmitter = DeviceEventEmitter.addListener('updateLocation', this.onLocationChange.bind(this));
            RNGLocation.reconnect();
            RNGLocation.getLocation();
          }
        }
      } else {
        this.getLocation();
        this.timerID = setInterval(() => this.getLocation(), 5000);
      }
    }

    this.setState({ locationAccess: access });
  }
  componentDidMount() {
    this.requestLocationPermission();
    this._getPinsAsyncStorage();
  this.LoadDisclosure(); //Updates showDisclosure state if the user previously accepted
  }

  getLocation() {
    navigator.geolocation.getCurrentPosition((position) => {
      this.setState({ myPosition: position.coords });
    },
    (error) => { },
    { enableHighAccuracy: true, timeout: 2000, maximumAge: 1000 });
  }

  componentWillUnmount() {
    if (Platform.OS === 'ios') {
      clearInterval(this.timerID);
    } else {
      if (this.evEmitter) {
        RNGLocation.disconnect();
        this.evEmitter.remove();
      }
    }
  }

  showConfirmAddress() {
    const { myPosition } = this.state;
    var geoAddress;

    this.setState({
      loading: true,
      isModalVisible: true,
    });

    setTimeout(async () => {
      let res = await _doGeocode(myPosition.longitude, myPosition.latitude);

      if (res) {
        let arr = res.address.split(",");
        let country = arr[arr.length-1]; // unused
        let state_zip = arr[arr.length-2];
        let cState = (state_zip?state_zip.split(" ")[1]:null);
        let cZip = (state_zip?state_zip.split(" ")[2]:null);
        let cCity = arr[arr.length-3];
        let cStreet = arr[arr.length-4];

        this.setState({cStreet, cCity, cZip, cState, cUnit: null});
      }

      this.setState({
        loading: false,
      });
    }, 550);
  }

  doConfirmAddress = async () => {
    const { myPosition, cStreet, cUnit, cCity, cState, cZip } = this.state;
    var LL;
    var addr;
    var inputAddress = cStreet + (cUnit?" #"+cUnit:"") + ", " + cCity + ", " + cState + ", " + cZip;

    LL = {
      longitude: myPosition.longitude,
      latitude: myPosition.latitude,
    };

    this.setState({ inputPosition: LL, inputAddress: inputAddress, isModalVisible: false });
    this.map.animateToCoordinate(LL, 500)
    // second modal doesn't show because of the map animation (a bug?) - have it set after it's done
    setTimeout(() => { this.setState({ isKnockMenuVisible: true }); }, 550);
  }

  addpin(color) {
    let { inputPosition, myPins, inputAddress, form } = this.state;
    let epoch = Math.floor(new Date().getTime() / 1000);

    const pin = {
      id: epoch,
      latlng: {latitude: inputPosition.latitude, longitude: inputPosition.longitude},
      title: inputAddress,
      description: "Visited on "+new Date().toDateString(),
      color: color,
    };

    myPins.pins.push(pin);

    this._savePins(myPins, true);

    const { navigate } = this.props.navigation;
    if (color === "green") navigate('Survey', {refer: this, myPins: myPins, form: form});

  }

  //Load a saved showDisclosure
  LoadDisclosure = async () => {
    try {
    //Load with DisclosureKey
      const value = await storage.get(this.state.DisclosureKey);
      if (value !== null) {
      //Set state to variable if found
        this.setState({showDisclosure : value});
      }
    } catch (error) {    }
  }
  
  SaveDisclosure = async () => {
    try {
      //Save with DisclosureKey the value "false"
      await storage.set(this.state.DisclosureKey, "false");
    } catch (error) {
      console.error(error);
    }
  }

  _getPinsAsyncStorage = async () => {
    try {
      const value = await storage.get(this.state.asyncStorageKey);
      if (value !== null) {
        let myPins = JSON.parse(value);
        this.setState({ myPins: myPins });
      }
    } catch (error) {
      console.error(error);
    }
  }

  timeFormat(epoch) {
    let date = new Date(epoch*1000);
    return date.toLocaleDateString('en-us')+" "+date.toLocaleTimeString('en-us');
  }

  _savePins = async (myPins, local) => {
    let { dbx } = this.state;
    if (local) myPins.last_saved = Math.floor(new Date().getTime() / 1000);
    this.setState({myPins: myPins});
    try {
      let str = JSON.stringify(myPins);
      await storage.set(this.state.asyncStorageKey, str);
    } catch (error) {
      console.error(error);
    }
  }

  _syncPins = async () => {
    let { dbx, form, user, myPins } = this.state;

    if (myPins.last_synced > myPins.last_saved) return;

    this.setState({syncRunning: true});

    myPins.last_synced = Math.floor(new Date().getTime() / 1000);
    myPins.canvasser = user.dropbox.name.display_name;
    try {
      let str = JSON.stringify(myPins);
      await dbx.filesUpload({ path: form.folder_path+'/'+DeviceInfo.getUniqueID()+'.jtxt', contents: encoding.convert(str, 'ISO-8859-1'), mode: {'.tag': 'overwrite'} });
      this._savePins(myPins, false);
    } catch (error) {
      console.error(error);
    }

    this.setState({syncRunning: false, myPins: myPins});
  }

  doExport = async () => {
    let { dbx, form, myPins } = this.state;

    this.setState({exportRunning: true});
    this._syncPins(myPins);

    // download all sub-folder .jtxt files
    let folders = [];
    let jtxtfiles = [myPins]; // no need to download our own
    try {
      let res = await dbx.filesListFolder({path: form.folder_path});
      for (let i in res.entries) {
        item = res.entries[i];
        if (item['.tag'] != 'folder') continue;
        folders.push(item.path_display);
      }
    } catch (error) {
      console.warn(error);
    };

    // TODO: do in paralell... let objs = await Promise.all(pro.map(p => p.catch(e => e)));

    // for each folder, download all .jtxt files
    for (let f in folders) {
      try {
        let res = await dbx.filesListFolder({path: folders[f]});
        for (let i in res.entries) {
          item = res.entries[i];
          if (item.path_display.match(/\.jtxt$/)) {
            let data = await dbx.filesDownload({ path: item.path_display });
            jtxtfiles.push(JSON.parse(data.fileBinary));
          }
        }
      } catch (error) {
        console.warn(error);
      }
    }

    // convert to .csv file and upload
    let keys = Object.keys(form.questions);
    let csv = "address,longitude,latitude,canvasser,datetime,color,"+keys.join(",")+"\n";
    for (let f in jtxtfiles) {
      let obj = jtxtfiles[f];
      for (let i in obj.pins) {
        csv += '"'+obj.pins[i].title+'"'+
          ","+obj.pins[i].latlng.longitude+
          ","+obj.pins[i].latlng.latitude+
          ","+obj.canvasser+
          ","+this.timeFormat(obj.pins[i].id)+
          ","+obj.pins[i].color;
        for (let key in keys)
          csv += ","+(obj.pins[i].survey ? obj.pins[i].survey[keys[key]] : '');
        csv += "\n";
      }
    }

    try {
      dbx.filesUpload({ path: form.folder_path+'/'+form.name+'.csv', contents: encoding.convert(csv, 'ISO-8859-1'), mode: {'.tag': 'overwrite'} });
    } catch(error) {
      console.warn(error);
    }

    this.setState({ exportRunning: false });

  }
  
  _canvassUrlHandler() {
    const url = "https://github.com/OurVoiceUSA/OVMobile/blob/master/docs/Canvassing-Guidelines.md";
    return Linking.openURL(url).catch(() => null);
  }

  render() {

    const { navigate } = this.props.navigation;
    const {
      showDisclosure, myPosition, myPins, locationAccess, serviceError, form, user,
      cStreet, cUnit, cCity, cState, cZip, loading, dbx, DropboxShareScreen, exportRunning, syncRunning,
    } = this.state;

    if (showDisclosure === "true") {
      return (
        <ScrollView style={{flex: 1, backgroundColor: 'white'}}>
          <View style={styles.content}>
            <Text style={{margin: 15, fontSize: 18, color: 'dimgray'}}>
              Our Voice provides this canvassing tool for free for you to use for your own purposes. You will be talking
              to real people and asking real questions about policy positions that matter, and hopefully also collaborating
              with other canvassers. Together, we can crowd source the answers to how our country thinks outside of
              partisan politics.
            </Text>

            <View style={{margin: 15}}>
              <Text style={{fontSize: 18, color: 'dimgray'}}>
                By using this tool you acknowledge that you are acting on your own behalf, do not represent Our Voice Initiative
                or its affiliates, and have read our <Text style={{fontSize: 18, fontWeight: 'bold', color: 'blue'}} onPress={() => {this._canvassUrlHandler()}}>
                canvassing guidelines</Text>. Please be courteous to those you meet.
              </Text>
            </View>

                <View style={{margin: 5, flexDirection: 'row'}}>
                  <Icon.Button
                    name="check-circle"
                    backgroundColor="#d7d7d7"
                    color="#000000"
                    onPress={() => {
                      this.setState({ showDisclosure: "false"}); //Hide disclosure
                      this.SaveDisclosure(); //Save the disclosures acceptance
                    }}
                    {...iconStyles}>
                    I understand & agree to the guidelines
                  </Icon.Button>
                </View>

                <View style={{margin: 5, flexDirection: 'row'}}>
                  <Icon.Button
                    name="ban"
                    backgroundColor="#d7d7d7"
                    color="#000000"
                    onPress={() => {this.props.navigation.dispatch(NavigationActions.back())}}
                    {...iconStyles}>
                    I do not agree to this! Take me back!
                  </Icon.Button>
                </View>

          </View>
        </ScrollView>
      );
    }

    if (locationAccess === false) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text>Access to your location is disabled.</Text>
            <Text>The canvassing tool requires it to be enabled.</Text>
          </View>
        </View>
      );
    }

    if (Platform.OS === 'android' && Platform.Version < 22) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text>Android version 5.1 or greater is required to run the canvassing app.</Text>
          </View>
        </View>
      );
    }

    if (serviceError === true) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text>Unable to load location services from your device.</Text>
          </View>
        </View>
      );
    }

    if (!myPosition) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text>Waiting on location data from your device...</Text>
            <ActivityIndicator />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>

        <MapView
          ref={component => this.map = component}
          initialRegion={{latitude: myPosition.latitude, longitude: myPosition.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005}}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          showsUserLocation={true}
          followsUserLocation={false}
          keyboardShouldPersistTaps={true}
          {...this.props}>
          {
            myPins.pins.map((marker, index) => (
              <MapView.Marker
                key={index}
                coordinate={marker.latlng}
                title={marker.title}
                description={marker.description}
                pinColor={marker.color}
                />
            ))
          }
        </MapView>
          <View style={{ alignSelf: 'flex-end' }}>
            {user.dropbox.account_id == form.author_id &&
            <View style={{marginBottom: 20}}>
              <Icon name="share-square" size={50} color="#808080" style={{marginBottom: 20}} onPress={() => this.setState({DropboxShareScreen: true})} />
              {exportRunning &&
              <ActivityIndicator size="large" />
              ||
              <Icon name="save" size={50} color="#b20000" onPress={() => this.doExport()} />
              }
            </View>
            }
            {(!myPins.last_synced || myPins.last_saved > myPins.last_synced || (syncRunning && !exportRunning)) &&
              <View>
              {syncRunning &&
              <ActivityIndicator size="large" />
              ||
              <Icon name="refresh" size={50} color="#00a86b" onPress={() => this._syncPins()} />
              }
              </View>
            }
            <Icon name="compass" size={50} color="#0084b4" onPress={() => this.map.animateToCoordinate({latitude: myPosition.latitude, longitude: myPosition.longitude}, 1000)} />
          </View>
        <View style={styles.buttonContainer}>
          <Icon.Button
            name="hand-rock-o"
            backgroundColor="#d7d7d7"
            color="#000000"
            onPress={() => {this.showConfirmAddress();}}
            {...iconStyles}>
            Prepare to Knock
          </Icon.Button>
        </View>

        <Modal
          open={this.state.isModalVisible}
          modalStyle={{width: 335, height: 400, backgroundColor: "transparent",
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}}
          style={{alignItems: 'center'}}
          offset={0}
          overlayBackground={'rgba(0, 0, 0, 0.75)'}
          animationDuration={200}
          animationTension={40}
          modalDidOpen={() => undefined}
          modalDidClose={() => this.setState({isModalVisible: false})}
          closeOnTouchOutside={true}
          disableOnBackPress={false}>
          <View style={{flexDirection: 'column'}}>
            <View style={{width: Dimensions.get('window').width * 0.7, height: 245, backgroundColor: 'white', marginTop: 15, borderRadius: 15, padding: 25, alignSelf: 'flex-start'}}>
              {loading &&
              <View>
                <Text style={{color: 'blue', fontWeight: 'bold', fontSize: 15}}>Loading Address</Text>
                <ActivityIndicator size="large" />
              </View>
              ||
              <View>
              <Text style={{color: 'blue', fontWeight: 'bold', fontSize: 15}}>Confirm the Address</Text>
                <View>
                  <Text style={styles.baseText, {position: 'absolute', bottom: -53, fontSize: 12}}>Street Address</Text>
                  <View style={{flexDirection: 'row', position: 'absolute', right: 80, bottom: -45, alignItems: 'center'}}>
                    <TextInput style={{height: 45, width: 135, fontSize: 15 }}
                      onChangeText={(text) => {this.setState({cStreet: text});}}
                      underlineColorAndroid={'transparent'}
                      value={cStreet}
                      multiline={false}
                    />
                   <View style={{position: 'absolute', bottom:10, width: 135, right: -3, height: 1, backgroundColor: 'gray'}} />
                 </View>
                 <Text style={styles.baseText, {position: 'absolute', bottom: -93, fontSize: 12}}>Unit #</Text>
                 <TextInput
                   style={{height: 45, width: 100, fontSize: 15, flexDirection: 'row', position: 'absolute', right: 110, bottom: -85, alignItems: 'center'}}
                  onChangeText={(text) => {this.setState({cUnit: text});}}
                   underlineColorAndroid={'transparent'}
                   value={cUnit}
                   multiline={false}
                 />
                 <View style={{position: 'absolute', bottom:-75, width: 100, right: 110, height: 1, backgroundColor: 'gray'}} />
                 <Text style={styles.baseText, {position: 'absolute', bottom: -137, fontSize: 12}}>City</Text>
                 <Text style={styles.baseText, {position: 'absolute', right:53,bottom: -137, fontSize: 12}}>State</Text>
                 <Text style={styles.baseText, {position: 'absolute', right:27, bottom: -137, fontSize: 12}}>Zip</Text>
                 <View style={{flexDirection: 'row', position: 'absolute', right: 0, bottom: -130, alignItems: 'center'}}>
                 <TextInput
                   style={{height: 45, width: 130, fontSize: 15 }}
                   onChangeText={(text) => {this.setState({cCity: text});}}
                   underlineColorAndroid={'transparent'}
                   value={cCity}
                   multiline={false}
                 />
                 <View style={{position: 'absolute', bottom:10, width: 125, right: 85, height: 1, backgroundColor: 'gray'}} />
                 <TextInput
                   style={{height: 45, width: 30, fontSize: 15 }}
                   onChangeText={(text) => {this.setState({cState: text});}}
                   underlineColorAndroid={'transparent'}
                   value={cState}
                   multiline={false}
                 />
                 <View style={{position: 'absolute', bottom:10, width: 25, right: 53, height: 1, backgroundColor: 'gray'}} />
                 <TextInput
                   style={{height: 45, width: 50, fontSize: 15}}
                   onChangeText={(text) => {this.setState({cZip: text});}}
                   underlineColorAndroid={'transparent'}
                   value={cZip}
                   multiline={false}
                 />
                 <View style={{position: 'absolute', bottom:10, width: 48, right: 0, height: 1, backgroundColor: 'gray'}} />
               </View>
               <View style={{flexDirection: 'row', position: 'absolute', right: 25, bottom: -185, alignItems: 'center'}}>
                 <TouchableOpacity style={{marginLeft: 30, backgroundColor: '#d7d7d7', padding: 10, borderRadius: 20}}
                   onPress={() => this.setState({isModalVisible: false})}>
                   <Text style={{fontWeight: 'bold', color: 'blue'}}>Cancel</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={{marginLeft: 30, backgroundColor: '#d7d7d7', padding: 10, borderRadius: 20}}
                   onPress={() => { this.doConfirmAddress(); }}>
                   <Text style={{fontWeight: 'bold', color: 'blue'}}>    OK    </Text>
                 </TouchableOpacity>
               </View>
               </View>
             </View>
             }
          </View>
        </View>
      </Modal>

        <Modal
          open={this.state.isKnockMenuVisible}
          modalStyle={{width: 335, height: 400, backgroundColor: "transparent",
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}}
          style={{alignItems: 'center'}}
          offset={0}
          overlayBackground={'rgba(0, 0, 0, 0.75)'}
          animationDuration={200}
          animationTension={40}
          modalDidOpen={() => undefined}
          modalDidClose={() => this.setState({isKnockMenuVisible: false})}
          closeOnTouchOutside={true}
          disableOnBackPress={false}>
          <View style={{flexDirection: 'column'}}>
            <View style={{width: Dimensions.get('window').width * 0.7, height: 260, backgroundColor: 'white', marginTop: 15, borderRadius: 15, padding: 25, alignSelf: 'flex-start'}}>
              <Text style={{color: 'blue', fontWeight: 'bold', fontSize: 20}}>Are they home?</Text>
              <View>

                <View style={{margin: 5, flexDirection: 'row'}}>
                  <Icon.Button
                    name="check-circle"
                    backgroundColor="#d7d7d7"
                    color="#000000"
                    onPress={() => {this.setState({ isKnockMenuVisible: false }); this.addpin("green"); }}
                    {...iconStyles}>
                    Take Survey
                  </Icon.Button>
                </View>

                <View style={{margin: 5, flexDirection: 'row'}}>
                  <Icon.Button
                    name="circle-o"
                    backgroundColor="#d7d7d7"
                    color="#000000"
                    onPress={() => {this.setState({ isKnockMenuVisible: false }); this.addpin("yellow"); }}
                    {...iconStyles}>
                    Not Home
                  </Icon.Button>
                </View>

                <View style={{margin: 5, flexDirection: 'row'}}>
                  <Icon.Button
                    name="ban"
                    backgroundColor="#d7d7d7"
                    color="#000000"
                    onPress={() => {this.setState({ isKnockMenuVisible: false }); this.addpin("red"); }}
                    {...iconStyles}>
                    Not Interested
                  </Icon.Button>
                </View>

              </View>

              <TouchableOpacity onPress={() => this.setState({ isKnockMenuVisible: false })}>
                <Text style={{fontWeight: 'bold', color: 'blue'}}>Cancel</Text>
              </TouchableOpacity>

            </View>
          </View>
        </Modal>

        <Modal
          open={DropboxShareScreen}
          modalStyle={{width: 335, height: 400, backgroundColor: "transparent",
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}}
          style={{alignItems: 'center'}}
          offset={0}
          overlayBackground={'rgba(0, 0, 0, 0.75)'}
          animationDuration={200}
          animationTension={40}
          modalDidOpen={() => undefined}
          modalDidClose={() => this.setState({DropboxShareScreen: false})}
          closeOnTouchOutside={true}
          disableOnBackPress={false}>
          <DropboxSharePage refer={this} />
        </Modal>

      </View>
    );
  }
}

const iconStyles = {
  justifyContent: 'center',
  borderRadius: 10,
  padding: 10,
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  bubble: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
  },
  latlng: {
    width: 200,
    alignItems: 'stretch',
  },
  button: {
    width: 300,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
    backgroundColor: '#d7d7d7',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginVertical: 20,
    backgroundColor: 'transparent',
  },
  buttonText: {
    textAlign: 'center',
  },
});
