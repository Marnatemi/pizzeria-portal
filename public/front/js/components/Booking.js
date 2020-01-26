import { select, templates, settings, classNames } from '../settings.js';
import utils from '../utils.js';
import AmountWidget from './AmountWidget.js';
import DatePicker from './DatePicker.js';
import HourPicker from './HourPicker.js';

class Booking {
  constructor(wrapper) {

    const thisBooking = this;

    thisBooking.render(wrapper);
    thisBooking.initWidgets();
    thisBooking.getData();
    thisBooking.processReservation();
  }

  render(wrapper) {
    const thisBooking = this;

    const generatedHTML = templates.bookingWidget();

    thisBooking.dom = {};

    thisBooking.dom.wrapper = wrapper;

    thisBooking.dom.wrapper.innerHTML = generatedHTML;

    thisBooking.dom.peopleAmount = thisBooking.dom.wrapper.querySelector(select.booking.peopleAmount);
    thisBooking.dom.hoursAmount = thisBooking.dom.wrapper.querySelector(select.booking.hoursAmount);
    thisBooking.dom.datePicker = thisBooking.dom.wrapper.querySelector(select.widgets.datePicker.wrapper);
    thisBooking.dom.hourPicker = thisBooking.dom.wrapper.querySelector(select.widgets.hourPicker.wrapper);
    thisBooking.dom.tables = thisBooking.dom.wrapper.querySelectorAll(select.booking.tables);
    thisBooking.dom.form = thisBooking.dom.wrapper.querySelector(select.booking.form);
    thisBooking.dom.starters = thisBooking.dom.wrapper.querySelectorAll(select.booking.starters);
    thisBooking.phone = thisBooking.dom.wrapper.querySelector(select.booking.phone);
    thisBooking.address = thisBooking.dom.wrapper.querySelector(select.booking.address);
  }

  getData() {
    const thisBooking = this;

    const startDayParam = settings.db.dateStartParamKey + '=' + utils.dateToStr(thisBooking.datePicker.minDate);
    const endDayParam = settings.db.dateEndParamKey + '=' + utils.dateToStr(thisBooking.datePicker.maxDate);

    const params = {
      booking: [
        startDayParam,
        endDayParam,

      ],
      eventsCurrent: [
        startDayParam,
        endDayParam,
        settings.db.notRepeatParam,
      ],
      eventsRepeat: [
        endDayParam,
        settings.db.repeatParam,
      ],
    };

    //console.log('getData param', params);

    const urls = {
      booking: settings.db.url + '/' + settings.db.booking
        + '?' + params.booking.join('&'),
      eventsCurrent: settings.db.url + '/' + settings.db.event
        + '?' + params.eventsCurrent.join('&'),
      eventsRepeat: settings.db.url + '/' + settings.db.event
        + '?' + params.eventsRepeat.join('&'),
    };

    //console.log(urls);

    Promise.all([
      fetch(urls.booking),
      fetch(urls.eventsCurrent),
      fetch(urls.eventsRepeat),
    ])
      .then(function (allResponses) {
        const bookingsResponse = allResponses[0];
        const eventsCurrentResponse = allResponses[1];
        const eventsRepeatResponse = allResponses[2];
        return Promise.all([
          bookingsResponse.json(),
          eventsCurrentResponse.json(),
          eventsRepeatResponse.json(),
        ]);
      })
      .then(function ([bookings, eventsCurrent, eventsRepeat]){
        //console.log(bookings);
        //console.log(eventsCurrent);
        //console.log(eventsRepeat);
        thisBooking.parseData(bookings, eventsCurrent, eventsRepeat);
      });
  }

  parseData(bookings, eventsCurrent, eventsRepeat){
    const thisBooking = this;

    thisBooking.booked = {};

    for(let item of eventsCurrent){
      thisBooking.makeBooked(item.date, item.hour, item.duration, item.table);
    }

    for(let item of bookings){
      thisBooking.makeBooked(item.date, item.hour, item.duration, item.table);
    }

    const minDate = thisBooking.datePicker.minDate; 
    const maxDate = thisBooking.datePicker.maxDate;

    for(let item of eventsRepeat){
      if(item.repeat == 'daily'){
        for(let loopDate = minDate; loopDate <= maxDate; loopDate = utils.addDays(loopDate, 1)){
          thisBooking.makeBooked(utils.dateToStr(loopDate), item.hour, item.duration, item.table);
        }        
      }
    }

    //console.log('thisBooking.booked', thisBooking.booked);
    thisBooking.updateDOM();
  }

  processReservation(){
    const thisBooking = this;

    for(let table of thisBooking.dom.tables){
      table.addEventListener('click', function(){
        thisBooking.bookedYet = [];

        thisBooking.table = table.getAttribute(settings.booking.tableIdAttribute);

        if(!isNaN(thisBooking.table)){
          thisBooking.table = parseInt(thisBooking.table);
        }

        for(let hour in thisBooking.booked[thisBooking.date]){

          let allTableReservations = thisBooking.booked[thisBooking.date][hour].indexOf(thisBooking.table);

          if (allTableReservations != -1 && hour > thisBooking.hourPicker.value){
            thisBooking.bookedYet.push(hour);
          }
        }
        
        thisBooking.nextReservation = thisBooking.bookedYet[0];
        //console.log('nextReservation', thisBooking.nextReservation);
        //console.log('reservationEnd', thisBooking.reservationEnd);

        if (thisBooking.nextReservation - thisBooking.reservationEnd >= 0 || typeof thisBooking.nextReservation == 'undefined'){
          table.classList.toggle(classNames.booking.tableSelected);
        }
      });

      thisBooking.dom.datePicker.addEventListener('updated', function(){
        table.classList.remove(classNames.booking.tableSelected);
      });

      thisBooking.dom.hourPicker.addEventListener('updated', function(){
        table.classList.remove(classNames.booking.tableSelected);
        thisBooking.dom.hoursAmount.value = settings.amountWidget.defaultMin;
      });
    }

    thisBooking.dom.form.addEventListener('submit', function(){
      event.preventDefault();

      if(typeof thisBooking.table != 'undefined'){
        thisBooking.sendReservation();
      }

    });
  }

  sendReservation(){
    const thisBooking = this;

    const url = settings.db.url + '/' + settings.db.booking;
    //console.log('url', url);

    const payload = {
      phone: thisBooking.phone.value,
      address: thisBooking.address.value,
      date: thisBooking.datePicker.value,
      hour: thisBooking.hourPicker.value,
      table: thisBooking.table,
      repeat: false,
      duration: thisBooking.dom.hoursAmount.value,
      ppl: thisBooking.dom.peopleAmount.value,
      starters: [],
    };

    for(let input of thisBooking.dom.starters){
      const starterValue = input.getAttribute(settings.booking.starterValueAttribute);
      if(input.checked){
        payload.starters.push(starterValue);
      }
    }

    //console.log(payload);
      
    thisBooking.makeBooked(payload.date, payload.hour, payload.duration, payload.table);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    };

    fetch(url, options) 
      .then(response => response.json()) 
      .then(parsedResponse => {
        console.log('parsedResponse', parsedResponse);
      }); 

  }


  makeBooked(date, hour, duration, table){
    const thisBooking = this;

    if(typeof thisBooking.booked[date] == 'undefined'){
      thisBooking.booked[date] = {};
    }

    const startHour = utils.hourToNumber(hour);

    for(let hourBlock = startHour ; hourBlock < startHour + duration; hourBlock += 0.5){
      ////console.log('loop', hourBlock);

      if(typeof thisBooking.booked[date][hourBlock] == 'undefined'){
        thisBooking.booked[date][hourBlock] = [];
      }
      
      thisBooking.booked[date][hourBlock].push(table);
    }
  }

  updateDOM(){
    const thisBooking = this;

    thisBooking.date = thisBooking.datePicker.value;
    thisBooking.hour = utils.hourToNumber(thisBooking.hourPicker.value);
    thisBooking.reservationEnd = thisBooking.hour + thisBooking.dom.hoursAmount.value ;
    thisBooking.hours = thisBooking.dom.hoursAmount.value ;

    let allAvailable = false;

    if (thisBooking.reservationEnd  > settings.hours.close){
      thisBooking.dom.hoursAmount.value = (settings.hours.close - thisBooking.hour);
    } else if (thisBooking.reservationEnd > thisBooking.nextReservation){
      thisBooking.dom.hoursAmount.value = (thisBooking.nextReservation - thisBooking.hour); 
    }

    if(
      typeof thisBooking.booked[thisBooking.date] == 'undefined'
      ||
      typeof thisBooking.booked[thisBooking.date][thisBooking.hour] == 'undefined'
    ){
      allAvailable = true;
    }

    for(let table of thisBooking.dom.tables){
      
      let tableId = table.getAttribute(settings.booking.tableIdAttribute);
      if(!isNaN(tableId)){
        tableId = parseInt(tableId);
      }

      if(
        !allAvailable
        &&
        thisBooking.booked[thisBooking.date][thisBooking.hour].includes(tableId)
      ){
        table.classList.remove(classNames.booking.tableSelected);
        table.classList.add(classNames.booking.tableBooked);
      }else{
        table.classList.remove(classNames.booking.tableBooked);
      }
    }
  }

  initWidgets() {
    const thisBooking = this;

    thisBooking.dom.peopleAmount = new AmountWidget(thisBooking.dom.peopleAmount);
    thisBooking.dom.hoursAmount = new AmountWidget(thisBooking.dom.hoursAmount);
    thisBooking.datePicker = new DatePicker(thisBooking.dom.datePicker);
    thisBooking.hourPicker = new HourPicker(thisBooking.dom.hourPicker);

    thisBooking.dom.wrapper.addEventListener('updated', function(){
      thisBooking.updateDOM();
    });
  }
}

export default Booking;