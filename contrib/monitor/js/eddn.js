var updateInterval      = 60000,

    monitorEndPoint     = 'https://eddn.edcd.io:9091/',

    //gatewayBottlePort   = 8080,
    gatewayBottlePort   = 4430,
    relayBottlePort     = 9090,

    gateways            = [
        'eddn.edcd.io'
    ], //TODO: Must find a way to bind them to monitor

    relays              = [
        'eddn.edcd.io'
    ]; //TODO: Must find a way to bind them to monitor

var stats = {
    'gateways' : {},
    'relays'   : {}
}; // Stats placeholder

formatNumber = function(num) {
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
}

var makeSlug = function(str) {
	var slugcontent_hyphens = str.replace(/\s/g,'-');
	var finishedslug = slugcontent_hyphens.replace(/[^a-zA-Z0-9\-]/g,'');
	return finishedslug.toLowerCase();
}

var makeName =  function(str) {
	var match = /^https:\/\/eddn.edcd.io\/schemas\/(\w)(\w*)\/(\d+)$/.exec(str);
	if(match)
	{
		return match[1].toUpperCase() + match[2] + " v" + match[3];
	}

	var match = /^https:\/\/eddn.edcd.io\/schemas\/(\w)(\w*)\/(\d+)\/test$/.exec(str);
	if(match)
	{
		return match[1].toUpperCase() + match[2] + " v" + match[3] + " [TEST]";
	}

	return str;
}

secondsToDurationString = function(seconds) {
  var hours   = Math.floor(seconds / 3600);
  var minutes = Math.floor((seconds - (hours * 3600)) / 60);
  var seconds = seconds - (hours * 3600) - (minutes * 60);
  var days = 0;

  if (hours > 24) {
    days = Math.floor(hours / 24)
    hours = Math.floor((hours - days * 24) / 3600);
  }

  if (hours   < 10) {hours   = "0" + hours;}
  if (minutes < 10) {minutes = "0" + minutes;}
  if (seconds < 10) {seconds = "0" + seconds;}

  if (days > 0) {
    return days + "d " + hours + ":" + minutes + ":" + seconds;
  }
  else {
    return hours + ":" + minutes + ":" + seconds;
  }
}


var drillDownSoftware = false;
var currentDrillDown  = false;

var softwaresSort = { field: 'today', order: 'desc' }; // Very first load sort order
var softwaresTotal    = new Array();
var softwaresVersion  = {};

var doUpdateSoftwares = function()
{
    var dToday      = new Date(),
        dYesterday  = new (function(d){ d.setDate(d.getDate()-1); return d})(new Date),

        yesterday   = dYesterday.getUTCFullYear() + '-' + ("0" + (dYesterday.getUTCMonth() +　1)).slice(-2) + '-' + ("0" + (dYesterday.getUTCDate())).slice(-2),
        today       = dToday.getUTCFullYear() + '-' + ("0" + (dToday.getUTCMonth() +　1)).slice(-2) + '-' + ("0" + (dToday.getUTCDate())).slice(-2);

    /*
     * Gathering the data per a "<softwareName> | <softwareVersion>" tuple takes two calls.
     *
     *  1) First a /getSoftwares/?dateStart=<yesterday>&dateEnd=<today>
     *
     *      This returns an object with two top level keys, one for each date.  The value
     *      for each is another object with "<softwareName> | <softwareVersion>" as each key,
     *      and the value as the count for that tuple.
     *
     *  2) Then the lifetime totals for each "<softwareName> | <softwareVersion>" tuple, from
     *     /getTotalSoftwares/
     *
     *      This returns an object with "<softwareName> | <softwareVersion>" tuples as keys,
     *      the values being the lifetime totals for each tuple.
     *
     *  The calls are nested here, so only the inner .ajax() has access to the totality of data.
     */
    $.ajax({
        dataType: "json",
        url: monitorEndPoint + 'getSoftwares/?dateStart=' + yesterday + '&dateEnd = ' + today,
        success: function(softwares){
            $.ajax({
                dataType: "json",
                url: monitorEndPoint + 'getTotalSoftwares/',
                success: function(softwaresTotalData){
                    var chart   = $('#software .chart').highcharts(),
                        series  = chart.get('softwares');

                    /*
                     * Prepare 'softwareName' dictionary with the values being an array each:
                     *
                     *  0 - today count
                     *  1 - yesterday count
                     *  2 - total count
                     *
                     * XXX: This is the necessary format for the highcharts?
                     */
                    // Count total by software, all versions included
                    var softwareName = {};
                    $.each(softwaresTotalData, function(software, hits){
                        softwareSplit = software.split(' | ');

                        if(!softwareName[softwareSplit[0]])
                            softwareName[softwareSplit[0]] = [0,0, parseInt(hits)];
                        else
                            softwareName[softwareSplit[0]][2] += parseInt(hits);

                        // Might happen when nothing is received...
                        if(softwares[yesterday] == undefined)
                            softwares[yesterday] = [];
                        if(softwares[today] == undefined)
                            softwares[today] = [];

                        softwareName[softwareSplit[0]][0] += parseInt(softwares[today][software] || 0);
                        softwareName[softwareSplit[0]][1] += parseInt(softwares[yesterday][software] || 0);

                    });

                    // Populate array with dictionaries per software
                    softwaresTotal = new Array();
                    $.each(softwareName, function(software, hits){ softwaresTotal.push({name: software, today: hits[0], yesterday: hits[1], total: hits[2]}); });

                    /*
                    $('#software .table tbody').empty();

                    // Prepare drilldowns
                    $.each(softwaresTotalData, function(software, hits){
                        softwareSplit = software.split(' | ');

                        // Append a new DIV for this jsGrid to the "#software #tables" div
                        $('#software #tables').append(
                            $('<div/>').addClass('table-softwares').attr('id', 'table-softwares-' + makeSlug(softwareSplit[0]))
                        );
                        newJsGrid = $("#table-softwares-" + makeSlug(softwareSplit[0])).jsGrid({
                            width: "100%",

                            filtering: false,
                            inserting: false,
                            editing: false,
                            sorting: true,
                            visible: true, // Toggle to hide, duh

                            data: hits,

                            fields: [
                                {
                                    title: "",
                                    width: "30px",
                                    sorting: false,
                                    readOnly: true,
                                },
                                {
                                    title: softwareSplit[0],
                                    width: "50%",
                                    name: softwareSplit[1],
                                    type: "text",
                                    align: "left",
                                    readOnly: true,
                                },
                                {
                                    title: "Today hits",
                                    name: "today",
                                    type: "number",
                                    align: "right",
                                    readOnly: true,
                                    css: "stat today",
                                    itemTemplate: formatNumberJsGrid(softwares[today][software] || 0),
                                    sorter: function(i1, i2) { return jsGrid.sortStrategies.number(i2, i1); }, // Reverse the sorting, so DESC is first click
                                },
                                {
                                    title: "Yesterday hits",
                                    name: "yesterday",
                                    type: "number",
                                    align: "right",
                                    readOnly: true,
                                    css: "stat yesterday",
                                    itemTemplate: formatNumberJsGrid(softwares[yesterday][software] || 0),
                                    sorter: function(i1, i2) { return jsGrid.sortStrategies.number(i2, i1); }, // Reverse the sorting, so DESC is first click
                                },
                                {
                                    title: "Total hits",
                                    name: "total",
                                    type: "number",
                                    align: "right",
                                    readOnly: true,
                                    css: "stat total",
                                    itemTemplate: formatNumberJsGrid(hits),
                                    sorter: function(i1, i2) { return jsGrid.sortStrategies.number(i2, i1); }, // Reverse the sorting, so DESC is first click
                                },
                            ],
                        }).attr('data-type', 'drilldown').attr('data-name', softwareSplit[0]).on('mouseover', function(){
                            chart.get('software-' + makeSlug(software)).setState('hover');
                            chart.tooltip.refresh(chart.get('software-' + makeSlug(software)));
                        }).on('mouseout', function(){
                            chart.get('software-' + makeSlug(software)).setState('');
                            chart.tooltip.hide();
                        });
                        //$("#table-softwares-" + makeSlug(softwareSplit[0])).jsGrid("sort", softwaresSort);

                        if(!drillDownSoftware)
                            newJsGrid.hide();
                        else
                            if(softwareSplit[0] != currentDrillDown)
                                newJsGrid.hide();

                        if(!softwaresVersion[softwareSplit[0]])
                            softwaresVersion[softwareSplit[0]] = {};
                        if(!softwaresVersion[softwareSplit[0]][software])
                            softwaresVersion[softwareSplit[0]][software] = {
                                today: (softwares[today][software] || 0), yesterday: (softwares[yesterday][software] || 0), total: hits
                            };
                    });
                    */

                    if (! $("#table-softwares").length ) {
                        // Append a new DIV for this jsGrid to the "#software #tables" div
                        $('#software #tables').append(
                            $('<div/>').addClass('jsGridTable').attr('id', 'table-softwares')
                        );
                    } else {
                        // Store the last selected sort so we can apply it to the new version
                        softwaresSort = $("#table-softwares").jsGrid("getSorting");
                    }
                    newJsGrid = $("#table-softwares").jsGrid({
                        width: "100%",

                        filtering: false,
                        inserting: false,
                        editing: false,
                        sorting: true,
                        autoload: false,

                        visible: true, // Toggle to hide, duh

                        data: softwaresTotal,

                        rowRenderer: function(item) {
                            return $('<tr>').attr('data-type', 'parent').attr('data-name', item.name).on('click', function(event){
                                // Drilldown?
                            }).on('mouseover', function(){
                                chart.get('software-' + makeSlug(item.name)).setState('hover');
                                chart.tooltip.refresh(chart.get('software-' + makeSlug(item.name)));
                            }).on('mouseout', function(){
                                if(chart.get('software-' + makeSlug(item.name)))
                                    chart.get('software-' + makeSlug(item.name)).setState('');
                                chart.tooltip.hide();
                            }).append(
                                $('<td>').addClass('square').attr('data-name', item.name).css('width', '30px').css('padding', '8px')
                            ).append(
                                $('<td>').html('<strong>' + item.name + '</strong>').css('cursor','pointer').css('width', '50%')
                            )
                            .append(
                                $('<td>').addClass('stat today').html(formatNumber(item.today || 0))
                            )
                            .append(
                                $('<td>').addClass('stat yesterday').html(formatNumber(item.yesterday || 0))
                            )
                            .append(
                                $('<td>').addClass('stat total').html('<strong>' + formatNumber(item.total) + '</strong>')
                            );
                        },

                        fields: [
                            {
                                title: "",
                                width: "30px",
                                name: "chartslug",
                                // rowClick: <something to display the 'drilldown' for this software>,
                                sorting: false,
                                readOnly: true,
                            },
                            {
                                title: "Software name",
                                width: "50%",
                                name: "name",
                                type: "text",
                                align: "left",
                                readOnly: true,
                            },
                            {
                                title: "Today hits",
                                name: "today",
                                type: "number",
                                align: "right",
                                readOnly: true,
                                css: "stat today",
                                itemTemplate: formatNumberJsGrid,
                            },
                            {
                                title: "Yesterday hits",
                                name: "yesterday",
                                type: "number",
                                align: "right",
                                readOnly: true,
                                css: "stat yesterday",
                                itemTemplate: formatNumberJsGrid,
                            },
                            {
                                title: "Total hits",
                                name: "total",
                                type: "number",
                                align: "right",
                                readOnly: true,
                                css: "stat total",
                                itemTemplate: formatNumberJsGrid,
                                //sorter: function(i1, i2) { return jsGrid.sortStrategies.number(i2, i1); }, // Reverse the sorting, so DESC is first click
                            },
                        ],
                        onOptionChanged: function(grid, option, value) {
                            console.log('softwares.onOptionChanged(): %o, %o, %o', grid, option, value);
                        },
                        onRefreshed: function(grid) {
                            // Gets fired when sort is changed
                            //console.log('softwares.onRefreshed(): %o', grid);
                            if (grid && grid.grid && grid.grid._sortField) {
                                //console.log(' grid sort is: %o, %o', grid.grid._sortField.name, grid.grid._sortOrder);
                                //console.log(' saved sort is: %o', softwaresSort);
                                if (softwaresSort.field != grid.grid._sortField.name) {
                                    softwaresSort.field = grid.grid._sortField.name;
                                    $("#table-softwares").jsGrid("sort", softwaresSort);
                                    return;
                                } else {
                                    softwaresSort.order = grid.grid._sortOrder;
                                }
                                $.each(softwaresTotal, function(key, values) {
                                    if(!chart.get('software-' + makeSlug(values.name)))
                                    {
                                        //console.log('Adding data point sort is: %o', softwaresSort.field);
                                        // Populates the data into the overall Software pie chart as per current sort column
                                        series.addPoint({id: 'software-' + makeSlug(values.name), name: values.name, y: parseInt(values[grid.grid._sortField.name]), drilldown: true}, false);
                                    } else {
                                        // Populates the data into the overall Software pie chart as per current sort column
                                        chart.get('software-' + makeSlug(values.name)).update(parseInt(values[grid.grid._sortField.name]), false);
                                    }
                                });
                            }
                            chart.redraw();
                        },
                    });
                    // Re-apply the last stored sort
                    $("#table-softwares").jsGrid("sort", softwaresSort);

                    // Add main softwares
                    $.each(softwaresTotal, function(key, values){
                        /*
                        if(!chart.get('software-' + makeSlug(values.name)))
                        {
                            console.log('Adding data point sort is: %o', softwaresSort.field);
                            // Populates the data into the overall Software pie chart as per current sort column
                            series.addPoint({id: 'software-' + makeSlug(values.name), name: values.name, y: parseInt(values[softwaresSort.field]), drilldown: true}, false);
                        } else {
                            // Populates the data into the overall Software pie chart as per current sort column
                            chart.get('software-' + makeSlug(values.name)).update(parseInt(values[softwaresSort.field]), false);
                        }
                        */

                        $(".square[data-name='" + this.name + "']").css('background', chart.get('software-' + makeSlug(values.name)).color);

                    });

                    chart.redraw();

                    $('#software').find(".stat").removeClass("warning").each(function() {
                        if ($(this).html() == "0")
                            $(this).addClass("warning");
                    });

                    $('#software').find(".update_timestamp").html(d.toString("yyyy-MM-dd HH:mm:ss"));
                }
            });
        }
    });
}


var doUpdateSchemas = function()
{
    var dToday      = new Date(),
        dYesterday  = new (function(d){ d.setDate(d.getDate()-1); return d})(new Date),

        yesterday   = dYesterday.getUTCFullYear() + '-' + ("0" + (dYesterday.getUTCMonth() +　1)).slice(-2) + '-' + ("0" + (dYesterday.getUTCDate())).slice(-2),
        today       = dToday.getUTCFullYear() + '-' + ("0" + (dToday.getUTCMonth() +　1)).slice(-2) + '-' + ("0" + (dToday.getUTCDate())).slice(-2);

    $.ajax({
        dataType: "json",
        url: monitorEndPoint + 'getSchemas/?dateStart=' + yesterday + '&dateEnd = ' + today,
        success: function(schemas){
            $.ajax({
                dataType: "json",
                url: monitorEndPoint + 'getTotalSchemas/',
                success: function(schemasTotalTmp){
					// Convert old schemas and sum them to new schemas
                    schemasTotal = {};
                    $.each(schemasTotalTmp, function(schema, hits){
                        schema = schema.replace('http://schemas.elite-markets.net/eddn/', 'https://eddn.edcd.io/schemas/');
                        hits   = parseInt(hits);

                        if(schemasTotal[schema]){ schemasTotal[schema] += hits; }
                        else{ schemasTotal[schema] = hits; }
                    });

                    var chart   = $('#schemas .chart').highcharts(),
                        series  = chart.get('schemas');

                    $('#schemas .table tbody').empty();

                    $.each(schemasTotal, function(schema, hits){
                        // Might happen when nothing is received...
                        if(schemas[yesterday] == undefined)
                            schemas[yesterday] = [];
                        if(schemas[today] == undefined)
                            schemas[today] = [];

						// Convert old schemas and sum them to new schemas
						schemasYesterdayTmp = {};
						$.each(schemas[yesterday], function(schema, hits){
							schema = schema.replace('http://schemas.elite-markets.net/eddn/', 'https://eddn.edcd.io/schemas/');
							hits   = parseInt(hits);

							if(schemasYesterdayTmp[schema]){ schemasYesterdayTmp[schema] += hits; }
							else{ schemasYesterdayTmp[schema] = hits; }
						});
						schemas[yesterday] = schemasYesterdayTmp;

						schemasTodayTmp = {};
						$.each(schemas[today], function(schema, hits){
							schema = schema.replace('http://schemas.elite-markets.net/eddn/', 'https://eddn.edcd.io/schemas/');
							hits   = parseInt(hits);

							if(schemasTodayTmp[schema]){ schemasYesterdayTmp[schema] += hits; }
							else{ schemasTodayTmp[schema] = hits; }
						});
						schemas[today] = schemasTodayTmp;

                        var slug = makeSlug(schema);
                        var name = makeName(schema);

                        $('#schemas .table tbody').append(
                            newTr = $('<tr>').attr('data-name', schema).on('mouseover', function(){
                                chart.get('schema-' + slug).setState('hover');
                                chart.tooltip.refresh(chart.get('schema-' +slug));
                            }).on('mouseout', function(){
                                chart.get('schema-' + slug).setState('');
                                chart.tooltip.hide();
                            }).append(
                                $('<td>').addClass('square')
                            ).append(
                                $('<td>').html('<strong>' + name + '</strong>')
                            )
                            .append(
                                $('<td>').addClass('stat today').html(formatNumber(schemas[today][schema] || 0))
                            )
                            .append(
                                $('<td>').addClass('stat yesterday').html(formatNumber(schemas[yesterday][schema] || 0))
                            )
                            .append(
                                $('<td>').addClass('stat total').html('<strong>' + formatNumber(hits) + '</strong>')
                            )
                        );

                        if(!chart.get('schema-' + slug))
                            series.addPoint({id: 'schema-' + slug, name: name, y: parseInt(hits)}, false);
                        else
                            chart.get('schema-' + slug).update(parseInt(hits), false);

                        newTr.find('.square').css('background', chart.get('schema-' + slug).color);
                    });

                    chart.redraw();

                    $('#schemas').find(".stat").removeClass("warning").each(function() {
                        if ($(this).html() == "0")
                            $(this).addClass("warning");
                    });

                    $('#schemas').find(".update_timestamp").html(d.toString("yyyy-MM-dd HH:mm:ss"));
                }
            });
        }
    });
}


var doUpdates = function(type){
    $("select[name=" + type + "] option").each(function(){
        var currentItem = $(this).html(),
            isSelected  = $(this).is(':selected');

        $.ajax({
            dataType: "json",
            url: $(this).val(),
            success: function(data){
                d = new Date();

                stats[type][currentItem]['lastUpdate']  = d.toString("yyyy-MM-dd HH:mm:ss");
                stats[type][currentItem]['last']        = data;

                if(isSelected)
                    showStats(type, currentItem);

                var chart = $("#" + type + " .chart[data-name='" + currentItem + "']").highcharts();

                shift = chart.get('inbound').data.length > 60;
                chart.get('inbound').addPoint([d.getTime(), (data['inbound'] || {})['1min'] || 0], true, shift);

                if(type == 'gateways')
                {
                    shift = chart.get('invalid').data.length > 60;
                    chart.get('invalid').addPoint([d.getTime(), (data['invalid'] || {})['1min'] || 0], true, shift);
                }

                if(type == 'relays')
                {
                    shift = chart.get('duplicate').data.length > 60;
                    chart.get('duplicate').addPoint([d.getTime(), (data['duplicate'] || {})['1min'] || 0], true, shift);
                }

                shift = chart.get('outbound').data.length > 60;
                chart.get('outbound').addPoint([d.getTime(), (data['outbound'] || {})['1min'] || 0], true, shift);
            }
        });
    });
};

var showStats = function(type, currentItem){
    var el                  = $('#' + type),
        currentItemStats    = stats[type][currentItem]['last'];

    el.find(".inbound_1min").html((currentItemStats['inbound'] || {})['1min'] || 0);
    el.find(".inbound_5min").html((currentItemStats["inbound"] || {})['5min'] || 0);
    el.find(".inbound_60min").html((currentItemStats["inbound"] || {})['60min'] || 0);

    if(type == 'gateways')
    {
        el.find(".invalid_1min").html((currentItemStats["invalid"] || {})['1min'] || 0);
        el.find(".invalid_5min").html((currentItemStats["invalid"] || {})['5min'] || 0);
        el.find(".invalid_60min").html((currentItemStats["invalid"] || {})['60min'] || 0);

        el.find(".outdated_1min").html((currentItemStats["outdated"] || {})['1min'] || 0);
        el.find(".outdated_5min").html((currentItemStats["outdated"] || {})['5min'] || 0);
        el.find(".outdated_60min").html((currentItemStats["outdated"] || {})['60min'] || 0);
    }

    if(type == 'relays')
    {
        el.find(".duplicate_1min").html((currentItemStats["duplicate"] || {})['1min'] || 0);
        el.find(".duplicate_5min").html((currentItemStats["duplicate"] || {})['5min'] || 0);
        el.find(".duplicate_60min").html((currentItemStats["duplicate"] || {})['60min'] || 0);
    }

    el.find(".outbound_1min").html((currentItemStats["outbound"] || {})['1min'] || 0);
    el.find(".outbound_5min").html((currentItemStats["outbound"] || {})['5min'] || 0);
    el.find(".outbound_60min").html((currentItemStats["outbound"] || {})['60min'] || 0);

    el.find(".update_timestamp").html(stats[type][currentItem]['lastUpdate']);
    el.find(".version").html(currentItemStats['version'] || 'N/A');

    if (currentItemStats['uptime'])
        el.find(".uptime").html(secondsToDurationString(currentItemStats['uptime']));
    else
        el.find(".uptime").html('N/A');

    el.find(".stat").removeClass("warning").each(function() {
        if ($(this).html() == "0")
            $(this).addClass("warning");
    });

    el.find(".chart").hide();
    el.find(".chart[data-name='" + currentItem + "']").show();
    $(window).trigger('resize'); // Fix wrong size in chart
};



/**
 *  Launch monitoring
 */
var start       = function(){
    Highcharts.setOptions({global: {useUTC: false}});

    // Grab gateways
    //gateways = gateways.sort();
    $.each(gateways, function(k, gateway){
        gateway = gateway.replace('tcp://', '');
        gateway = gateway.replace(':8500', '');

        $("select[name=gateways]").append($('<option>', {
            value: 'https://' + gateway + ':' + gatewayBottlePort + '/stats/',
            text : gateway
        }));

        $('#gateways .charts').append(
                                $('<div>').addClass('chart')
                                          .css('width', '100%')
                                          .attr('data-name', gateway)
                             );

        $("#gateways .chart[data-name='" + gateway + "']").highcharts({
            chart: {
                type: 'spline', animation: Highcharts.svg
            },
            title: { text: '', style: {display: 'none'} },
            xAxis: {
                type: 'datetime',
                tickPixelInterval: 150
            },
            yAxis: {
                title: {text: ''},
                plotLines: [{value: 0, width: 1, color: '#808080'}],
                min: 0
            },
            tooltip: { enabled: false },
            credits: { enabled: false },
            exporting: { enabled: false },
            series: [
                {id: 'inbound', data: [], name: 'Messages received', zIndex: 300},
                {id: 'invalid', data: [], name: 'Invalid messages', zIndex: 1},
                {id: 'outdated', data: [], name: 'Outdated messages', zIndex: 1},
                {id: 'outbound', data: [], name: 'Messages passed to relay', zIndex: 200}
            ]
        }).hide();

        stats['gateways'][gateway] = {};
    });

    doUpdates('gateways');
    setInterval(function(){
        doUpdates('gateways');
    }, updateInterval);

    // Grab relays
    //relays = relays.sort();
    $.each(relays, function(k, relay){
        $("select[name=relays]").append($('<option>', {
            value: 'https://' + relay + ':' + relayBottlePort + '/stats/',
            text : relay
        }));

        $('#relays .charts').append(
                                $('<div>').addClass('chart')
                                          .css('width', '100%')
                                          .attr('data-name', relay)
                             );

        $("#relays .chart[data-name='" + relay + "']").highcharts({
            chart: {
                type: 'spline', animation: Highcharts.svg,
                events: {
                    load: function(){ setTimeout(function(){$(window).trigger('resize');}, 250); }
                },
                marginRight: 10
            },
            title: { text: '', style: {display: 'none'} },
            xAxis: {
                type: 'datetime',
                tickPixelInterval: 150
            },
            yAxis: {
                title: {text: ''},
                plotLines: [{value: 0, width: 1, color: '#808080'}],
                min: 0
            },
            tooltip: { enabled: false },
            credits: { enabled: false },
            exporting: { enabled: false },
            series: [
                {id: 'inbound', data: [], name: 'Messages received', zIndex: 300},
                {id: 'duplicate', data: [], name: 'Messages duplicate', zIndex: 1},
                {id: 'outbound', data: [], name: 'Messages passed to subscribers', zIndex: 200}
            ]
        }).hide();

        stats['relays'][relay] = {};
    });

    doUpdates('relays');
    setInterval(function(){
        doUpdates('relays');
    }, updateInterval);

    // Grab software from monitor
    $('#software .chart').highcharts({
        chart: {
            type: 'pie', animation: Highcharts.svg
        },
        title: { text: '', style: {display: 'none'} },
        credits: { enabled: false },
        tooltip: { headerFormat: '', pointFormat: '{point.name}: <b>{point.percentage:.1f}%</b>' },
        legend: { enabled: false },
        plotOptions: {pie: {allowPointSelect: false,dataLabels: { enabled: false }}},
        series: [{
            id: 'softwares',
            name: 'Softwares',
            type: 'pie',
            data: []
        }]
    });

    doUpdateSoftwares();
    setInterval(function(){
        doUpdateSoftwares();
    }, updateInterval);

    // Grab uploader from monitor
    $('#uploaders .chart').highcharts({
        chart: {
            type: 'pie', animation: Highcharts.svg
        },
        title: { text: '', style: {display: 'none'} },
        credits: { enabled: false },
        tooltip: { headerFormat: '', pointFormat: '{point.name}: <b>{point.percentage:.1f}%</b>' },
        legend: { enabled: false },
        plotOptions: {pie: {allowPointSelect: false,dataLabels: { enabled: false }}},
        series: [{
            id: 'uploaders',
            type: 'pie',
            data: []
        }]
    });

    // Grab schema from monitor
    $('#schemas .chart').highcharts({
        chart: {
            type: 'pie', animation: Highcharts.svg
        },
        title: { text: '', style: {display: 'none'} },
        credits: { enabled: false },
        tooltip: { headerFormat: '', pointFormat: '{point.name}: <b>{point.percentage:.1f}%</b>' },
        legend: { enabled: false },
        plotOptions: {pie: {allowPointSelect: false,dataLabels: { enabled: false }}},
        series: [{
            id: 'schemas',
            type: 'pie',
            data: []
        }]
    });

    doUpdateSchemas();
    setInterval(function(){
        doUpdateSchemas();
    }, updateInterval);

    // Attach events
    $("select[name=gateways]").change(function(){
        showStats('gateways', $(this).find('option:selected').html());
    });
    $("select[name=relays]").change(function(){
        showStats('relays', $(this).find('option:selected').html());
    });
}

/*
 * JS Grid related functions
 */

/*
 * Nicely format a number for jsGrid
 */
formatNumberJsGrid = function(value, item) {
    return value.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
}

$(document).ready(function(){
    start();
});
