const ViGEmClient = require('vigemclient');
const lepikEvents = require('../scripts/events');
const { ipcRenderer } = require('electron');
const fs = require('fs');

var mapControls = new Map();
var currentlySelected = null;
var isAssigning = false;
var isDialogOpen = false;

// Setup the controller

let client = new ViGEmClient();
client.connect(); // establish connection to the ViGEmBus driver

let controller = null;


try {
    controller = client.createX360Controller();

    controller.connect(); // plug in the virtual controller
} catch (err) {
    console.log(err);
    alert("Could not connect to the controller. Please visit the source files and install ViGEmBusDriver.msi.");
    
}

const idToGamepad = {
    "x_btn" : (state) => { controller.button.X.setValue(state); },
    "a_btn" : (state) => { controller.button.A.setValue(state); },
    "b_btn" : (state) => { controller.button.B.setValue(state); },
    "y_btn" : (state) => { controller.button.Y.setValue(state); },
    "start_btn" : (state) => { controller.button.START.setValue(state); },
    "back_btn" : (state) => { controller.button.BACK.setValue(state); },
    "left_shoulder_btn" : (state) => { controller.button.LEFT_SHOULDER.setValue(state); },
    "right_shoulder_btn" : (state) => { controller.button.RIGHT_SHOULDER.setValue(state); },
    "left_trigger_btn" : (state) => { controller.axis.leftTrigger.setValue(state ? 1 : 0); },
    "right_trigger_btn" : (state) => { controller.axis.rightTrigger.setValue(state ? 1 : 0); },
    "dpad_up_btn" : (state) => { controller.axis.dpadVert.setValue(state ? 1 : 0); },
    "dpad_down_btn" : (state) => { controller.axis.dpadVert.setValue(state ? -1 : 0); },
    "dpad_left_btn" : (state) => { controller.axis.dpadHorz.setValue(state ? -1 : 0); },
    "dpad_right_btn" : (state) => { controller.axis.dpadHorz.setValue(state ? 1 : 0); },
    "left_joystick_up_btn" : (state) => { controller.axis.leftY.setValue(state ? 1 : 0); },
    "left_joystick_right_btn" : (state) => { controller.axis.leftX.setValue(state ? 1 : 0); },
    "left_joystick_down_btn" : (state) => { controller.axis.leftY.setValue(state ? -1 : 0); },
    "left_joystick_left_btn" : (state) => { controller.axis.leftX.setValue(state ? -1 : 0); },
    "right_joystick_up_btn" : (state) => { controller.axis.rightY.setValue(state ? 1 : 0); },
    "right_joystick_right_btn" : (state) => { controller.axis.rightX.setValue(state ? 1 : 0); },
    "right_joystick_down_btn" : (state) => { controller.axis.rightY.setValue(state ? -1 : 0); },
    "right_joystick_left_btn" : (state) => { controller.axis.rightX.setValue(state ? -1 : 0); },
    
}

class ControlInput {

    constructor(input) {
        this.inputs = []
        if (Array.isArray(input)) {
            this.inputs = input;
        } else {
            this.inputs.push(input);
        }
        
    }

    addInput(input) {
        this.inputs.push(input);
    }

    getInputs() {
        return this.inputs;
    }

    removeInput(input) {
        this.inputs.splice(this.inputs.indexOf(input), 1);
    }

    hasInput(input) {
        var hasInput = false;
        this.inputs.forEach(function(i) {
            if (i.includes(input)) {
                hasInput = true;
            }
        });
        return hasInput;
    }

    length() {
        return this.inputs.length;
    }
}

document.addEventListener("DOMContentLoaded", () => {

    // Setup the window
    var accordion = document.getElementsByClassName("accordion");
    for (var i = 0; i < accordion.length; i++) {
        
        accordion[i].onclick = (event) => {
            var previous = document.getElementsByClassName("active");
            var same = false;
            if (previous.length > 0 && previous[0].id == event.target.id) same = true;
            resetAccordion();
            resetSelectBtn();
            resetAllAssigns();
            updateGamepadStatus();
            currentlySelected = null;
            isAssigning = false;

            if (!same) {
                event.target.classList.toggle("active");
                var panel = event.target.nextElementSibling;
                if (panel.style.maxHeight) {
                    panel.style.maxHeight = null;
                } else {
                    panel.style.maxHeight = panel.scrollHeight + "px";
                }
                
                currentlySelected = event.target.id.replace("menu_", "")
                document.getElementById(currentlySelected).classList.toggle("selected-btn");
            }
        };

    }

    var buttons = document.getElementsByClassName("gamepad-btn");
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].onclick = (event) => {
            document.getElementById("menu_" + event.target.id).click();
        }
    }

    document.getElementById('save').onclick = async (event) => {
        if (isDialogOpen) return;
        isDialogOpen = true;
        var result = await ipcRenderer.invoke('showSaveDialog');
        var data = {};
        for(const [key, value] of mapControls.entries()) {
            data[key] = value.getInputs();
        }
        var fileExt = result.filePath.split('.').pop();
        fs.writeFileSync(fileExt == "json" ? result.filePath : result.filePath + ".json", JSON.stringify(data));
        
        isDialogOpen = false;
    };

    document.getElementById('load').onclick = async (event) => {
        if (isDialogOpen) return;
        isDialogOpen = true;
        var result = await ipcRenderer.invoke('showOpenDialog');
        var data = JSON.parse(fs.readFileSync(result.filePaths[0]));

        
        mapControls = new Map();
        for (const [key, value] of Object.entries(data)) {
            var input = new ControlInput(value);
            mapControls.set(key, input);
        }

        resetAccordion();
        resetSelectBtn();
        resetAllAssigns();
        updateGamepadStatus();
        currentlySelected = null;
        isAssigning = false;

        var setupBtns = document.getElementsByClassName("setup-btn");
        for (var i = 0; i < setupBtns.length; i++) {
            var id = setupBtns[i].id.replace("setup_", "");
            for (const [key, value] of mapControls.entries()) {
                if (mapControls.get(key).hasInput(id)) {
                    setupBtns[i].classList.add("valid-setup-btn");
                    setupBtns[i].innerHTML = key.toUpperCase();
                    break;
                }
            }
        }
        isDialogOpen = false;;
};
});

lepikEvents.events.on('keyPress', (data) => {
    var event = mapControls.get(data);

    if (isAssigning) {
        var control = document.getElementById("setup_" + currentlySelected);

        if (currentlySelected.includes("dpad")) {
            if (document.getElementById("setup_dpad_up_btn").classList.contains("set-setup-btn")) control = document.getElementById("setup_dpad_up_btn");
            else if (document.getElementById("setup_dpad_down_btn").classList.contains("set-setup-btn")) control = document.getElementById("setup_dpad_down_btn");
            else if (document.getElementById("setup_dpad_left_btn").classList.contains("set-setup-btn")) control = document.getElementById("setup_dpad_left_btn");
            else if (document.getElementById("setup_dpad_right_btn").classList.contains("set-setup-btn")) control = document.getElementById("setup_dpad_right_btn");
        } else if (currentlySelected.includes("left_joystick")) {
            if (document.getElementById("setup_left_joystick_up_btn").classList.contains("set-setup-btn")) control = document.getElementById("setup_left_joystick_up_btn");
            else if (document.getElementById("setup_left_joystick_right_btn").classList.contains("set-setup-btn")) control = document.getElementById("setup_left_joystick_right_btn");
            else if (document.getElementById("setup_left_joystick_down_btn").classList.contains("set-setup-btn")) control = document.getElementById("setup_left_joystick_down_btn");
            else if (document.getElementById("setup_left_joystick_left_btn").classList.contains("set-setup-btn")) control = document.getElementById("setup_left_joystick_left_btn");
        } else if (currentlySelected.includes("right_joystick")) {
            if (document.getElementById("setup_right_joystick_up_btn").classList.contains("set-setup-btn")) control = document.getElementById("setup_right_joystick_up_btn");
            else if (document.getElementById("setup_right_joystick_right_btn").classList.contains("set-setup-btn")) control = document.getElementById("setup_right_joystick_right_btn");
            else if (document.getElementById("setup_right_joystick_down_btn").classList.contains("set-setup-btn")) control = document.getElementById("setup_right_joystick_down_btn");
            else if (document.getElementById("setup_right_joystick_left_btn").classList.contains("set-setup-btn")) control = document.getElementById("setup_right_joystick_left_btn");
        }

        control.innerHTML = String(data).toUpperCase();
        resetAllAssigns();
        isAssigning = false

        removeFromControls(control.id.replace("setup_", ""));
        
        if (event == undefined) {
            newControl = new ControlInput(control.id.replace("setup_", ""));
            mapControls.set(data, newControl);
        } else {
            event.addInput(control.id.replace("setup_", ""));
        }

    } else {

        if (event != undefined) {
            for (var i = 0; i < event.getInputs().length; i++) {
                var gamepadBtn = idToGamepad[event.getInputs()[i]];
                gamepadBtn(true);
            }
        }

    }
});

window.addEventListener('keydown', (e) => {  
    if (e.keyCode === 32) {  
      e.preventDefault();  
    }  
});

lepikEvents.events.on('keyRelease', (data) => {
    var event = mapControls.get(data);
    if (event != undefined) {
        for (var i = 0; i < event.getInputs().length; i++) {
            var gamepadBtn = idToGamepad[event.getInputs()[i]];
            gamepadBtn(false);
        }
    }
});

function removeFromControls(control) {
    for(const [key, value] of mapControls.entries()) {
        if (value.hasInput(control)) {
            value.removeInput(control);
            if (value.length() == 0) {
                mapControls.delete(key);
            }
        }
    }
}

function resetAccordion() {
    var accordion = document.getElementsByClassName("accordion");
    for (var i = 0; i < accordion.length; i++) {
        accordion[i].classList.remove("active");
        var panel = accordion[i].nextElementSibling;
        panel.style.maxHeight = null;
    }
}

function resetSelectBtn() {
    var selected = document.getElementsByClassName("selected-btn");
    for (var i = 0; i < selected.length; i++) {
        selected[i].classList.remove("selected-btn");
    }
}

function updateGamepadStatus() {
    var buttons = document.getElementsByClassName("gamepad-btn");
    for (var i = 0; i < buttons.length; i++) {

        var wasAssigned = false;
        buttons[i].classList.remove("assign-btn");

        for(const [key, value] of mapControls.entries()) {
            if (value.hasInput(buttons[i].id)) {
                wasAssigned = true;
                break;
            }
        }

        if (!wasAssigned) buttons[i].classList.add("assign-btn");
    }
}

function resetAllAssigns() {
    var controls = document.getElementsByClassName("set-setup-btn");
    for (var i = 0; i < controls.length; i++) {
        if (controls[i].innerHTML == "...") {
            removeFromControls(controls[i].id.replace("setup_", ""));
            controls[i].innerHTML = "Click to assign";
        } else {
            controls[i].classList.add("valid-setup-btn");
        }
        controls[i].classList.remove("set-setup-btn");
    }
}

function callAssign(btn) {
    isAssigning = !isAssigning;

    resetAllAssigns();
    if (isAssigning)  {
        var control = document.getElementById(btn);
        control.classList.add("set-setup-btn");
        control.classList.remove("valid-setup-btn");
        control.innerHTML = "..."
    }
}