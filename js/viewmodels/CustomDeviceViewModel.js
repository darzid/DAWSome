class CustomDeviceViewModel {
  device = {};
  state = {};
  
  constructor(deviceName) {
    this.deviceName = deviceName;
  }
  
  init() {}
  
  attach(device, state) {
    this.device = device;
    this.state = state;
  }
}