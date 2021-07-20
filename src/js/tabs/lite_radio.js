'use strict';

TABS.lite_radio = {
    rateChartHeight: 117,
    useSuperExpo: false,
    deadband: 0,
    yawDeadband: 0,
    analyticsChanges: {},
    needReboot: false,
};

TABS.lite_radio.initialize = function (callback) {
    const tab = this;

    if (GUI.active_tab != 'lite_radio') {
        GUI.active_tab = 'lite_radio';
    }

    function get_rc_data() {
        MSP.send_message(MSPCodes.MSP_RC, false, false, get_rssi_config);
    }

    function get_rssi_config() {
        MSP.send_message(MSPCodes.MSP_RSSI_CONFIG, false, false, get_rc_tuning);
    }

    function get_rc_tuning() {
        MSP.send_message(MSPCodes.MSP_RC_TUNING, false, false, get_rc_map);
    }

    function get_rc_map() {
        MSP.send_message(MSPCodes.MSP_RX_MAP, false, false, load_rc_configs);
    }

    function load_rc_configs() {
        const nextCallback = load_rx_config;
        if (semver.gte(FC.CONFIG.apiVersion, "1.15.0")) {
            MSP.send_message(MSPCodes.MSP_RC_DEADBAND, false, false, nextCallback);
        } else {
            nextCallback();
        }
    }

    function load_rx_config() {
        const nextCallback = load_mixer_config;
        if (semver.gte(FC.CONFIG.apiVersion, "1.20.0")) {
            MSP.send_message(MSPCodes.MSP_RX_CONFIG, false, false, nextCallback);
        } else {
            nextCallback();
        }
    }

    function load_mixer_config() {
        MSP.send_message(MSPCodes.MSP_MIXER_CONFIG, false, false, load_html);
    }

    function load_html() {
        $('#content').load("./tabs/lite_radio.html", process_html);
    }

    MSP.send_message(MSPCodes.MSP_FEATURE_CONFIG, false, false, get_rc_data);

    function process_html() {
        self.analyticsChanges = {};

        const featuresElement = $('.tab-lite-radio .features');

        FC.FEATURE_CONFIG.features.generateElements(featuresElement);

        // translate to user-selected language
        i18n.localizePage();

        // generate bars
        const bar_names = [
            'CH1',
            'CH2',
            'CH3',
            'CH4',
            'CH5',
            'CH6',
            'CH7',
            'CH8'
        ];

        const barContainer = $('.tab-lite-radio .bars');
        let auxIndex = 1;

        const numBars =  8;

        for (let i = 0; i < numBars; i++) {
            let name = bar_names[i];


            barContainer.append('\
                <ul>\
                    <li class="name">' + name + '</li>\
                    <li class="meter">\
                        <div class="meter-bar">\
                            <div class="fill' + (FC.RC.active_channels == 0 ? 'disabled' : '') + '">\
                            </div>\
                        </div>\
                    </li>\
                    <li class="value">\
                        <div class="label">100</div>\
                    </li>\
                    <li class="name"> Reverse </li>\
                    <li class="check">\
                        <input name="reverse" type="checkbox" value="" />\
                    </li>\
                    <li class="name"> INPUT </li>\
                    <li class="select">\
                        <select name="bar-type">\
                            <option value="aileron">Aileron</option>\
                            <option value="elevator">Elevator</option>\
                            <option value="throttle">Throttle</option>\
                            <option value="rudder">Rudder</option>\
                            <option value="sa">SA</option>\
                            <option value="sb">SB</option>\
                            <option value="sc">SC</option>\
                            <option value="sd">SD</option>\
                        </select>\
                    </li>\
                    <li class="name"> Weight </li>\
                    <li class="select">\
                        <select name="weight">\
                            <option value="50">50</option>\
                            <option value="100" selected="selected">100</option>\
                            <option value="200">200</option>\
                            <option value="300">300</option>\
                            <option value="2200">2200</option>\
                        </select>\
                    <li class="name"> Offset </li>\
                    <li class="select">\
                        <select name="offset">\
                            <option value="-100">-100 %</option>\
                            <option value="-75">-75 %</option>\
                            <option value="-50">-50 %</option>\
                            <option value="-25" >-25 %</option>\
                            <option value="0" selected="selected">0 %</option>\
                            <option value="25" >25 %</option>\
                            <option value="50">50 %</option>\
                            <option value="75">75 %</option>\
                            <option value="100">100 %</option>\
                        </select>\
                    </li>\
                </ul>\
            ');
            barContainer.find('ul').eq(i).find('select[name="bar-type"]').children().eq(i).prop('selected','selected');
        }
        // we could probably use min and max throttle for the range, will see
        const meterScale = {
            'min': [800,800,800,800,800,800,800,800],
            'max': [2200,2200,2200,2200,2200,2200,2200,2200]
        };
        const offset = {
            'value': [0,0,0,0,0,0,0,0]
        }
        const meterFillArray = [];
        $('.meter .fill', barContainer).each(function () {
            meterFillArray.push($(this));
        });
        const meterLabelArray = [];
        $('.value', barContainer).each(function () {
            meterLabelArray.push($('.label', this));
        });
        // correct inner label margin on window resize (i don't know how we could do this in css)
        /*
        tab.resize = function () {
            const containerWidth = $('.meter:first', barContainer).width(),
                labelWidth = $('.meter .label:first', barContainer).width(),
                margin = (containerWidth / 2) - (labelWidth / 2);

            for (let i = 0; i < meterLabelArray.length; i++) {
                meterLabelArray[i].css('margin-left', margin);
            }
        };

        $(window).on('resize', tab.resize).resize(); // trigger so labels get correctly aligned on creation
        */

        function get_rc_refresh_data() {
            MSP.send_message(MSPCodes.MSP_RC, false, false, update_ui);
        }

        function update_ui() {

            if (FC.RC.active_channels > 0) {

                // update bars with latest data

                for (let i = 0; i < FC.RC.active_channels; i++) {
                    var realOffset=offset.value[i]*0.01*2*meterScale.max[i];
                    meterFillArray[i].css('width', ((FC.RC.channels[i] - (meterScale.min[i]+realOffset)) / (meterScale.max[i] - meterScale.min[i]) * 100).clamp(0, 100)+ '%');
                    var left=parseInt(meterScale.min[i],10)+realOffset;
                    var right=parseInt(meterScale.max[i],10)+realOffset;
                    meterLabelArray[i].text(FC.RC.channels[i]+'('+left+','+right+')');
                }
            }
        }
        //when reverse
        $('.tab-lite-radio .check input').change(function () {
            var temp=$(this).parent().parent().find('div.fill');
            if($(this).prop('checked')==true)
                temp.css('float', "right");
            else
                temp.css('float', "left");
        });
        //change weight
        $('.tab-lite-radio select[name="weight"]').change(function(){
            var tempweight=$(this).val();
            var id=$(this).parent().parent().index();
            meterScale.min[id]=-tempweight;
            meterScale.max[id]=tempweight;
        });
        //offset
        $('.tab-lite-radio select[name="offset"]').change(function(){
            var tempoffset=$(this).val();
            var id=$(this).parent().parent().index();
            offset.value[id]=tempoffset;
        });
        // timer initialization
        GUI.interval_remove('lite_radio_pull');
        // enable RC data pulling
        var plotUpdateRate = 50;

        GUI.interval_add('lite_radio_pull', get_rc_refresh_data, plotUpdateRate, true);
        
        // Setup model for preview


        GUI.interval_remove('status_pull');
        // status data pulled via separate timer with static speed
        GUI.interval_add('status_pull', function status_pull() {
            MSP.send_message(MSPCodes.MSP_STATUS);
        }, 250, true);
        
        GUI.content_ready(callback);
    }
};

TABS.lite_radio.cleanup = function (callback) {
    $(window).off('resize', this.resize);
    if (this.model) {
        $(window).off('resize', $.proxy(this.model.resize, this.model));
        this.model.dispose();
    }

    this.keepRendering = false;

    if (callback) callback();
};