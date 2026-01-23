sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], (Controller, JSONModel, MessageToast) => {
    "use strict";

    return Controller.extend("com.triumph.putawaybymarriage.controller.DestinationBinConfrirm", {
        onInit: function () {
            console.log("onInit-DestinationBinConfrirm");
        },
        onBack: function () {
            const oRoute = this.getOwnerComponent().getRouter();
            oRoute.navTo("DestinationBin");

        }
    });
});