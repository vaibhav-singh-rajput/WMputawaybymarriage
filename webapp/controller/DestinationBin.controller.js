sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], (Controller, JSONModel, MessageToast) => {
    "use strict";

    return Controller.extend("com.triumph.putawaybymarriage.controller.DestinationBin", {
        onInit: function () {
            console.log("onInit-DestinationBin");
        },
        onNext: function () {
            this.getOwnerComponent().getRouter().navTo("DestinationBinConfirm");
        },
        onBack: function () {
            const oRoute = this.getOwnerComponent().getRouter();
            oRoute.navTo("RouteMain");

        }
    });
});