sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], (Controller, JSONModel, MessageToast) => {
    "use strict";

    return Controller.extend("com.triumph.putawaybymarriage.controller.DestinationBin", {
        onInit: function () {
            //Model intilization
            this._oScannerModel = this.getOwnerComponent().getModel("scannerModel");

            console.log("onInit-DestinationBin");
            const oModel = this.getOwnerComponent().getModel("scannerModel");
            console.log("Scanner Model:", oModel && oModel.getData());


            this.getOwnerComponent()
                .getRouter()
                .getRoute("DestinationBin")
                .attachPatternMatched(this._onRouteMatched, this);
        },
        _onRouteMatched: function () {
            const iIndex = this._oScannerModel.getProperty("/currentIndex");

            // 🔑 THIS is the only correct way
            this.getView().bindElement({
                path: `/items/${iIndex}`,
                model: "scannerModel"
            });

            // console.log("Bound to index:", iIndex);

            //Set focus into first field of page - input of DestinationBin
            var that = this;
            this.getView().addEventDelegate({
                onAfterShow: function (evt) {
                    setTimeout(function () {
                        document.getElementById(that.getView().byId("inputDestinationBin").getFocusDomRef().id).focus();
                    }, 0);
                }
            });
        },

        onClear: function () {

            const iIndex = this._oScannerModel.getProperty("/currentIndex");
            this._oScannerModel.setProperty(`/items/${iIndex}/destinationBin`, '');
            this._oScannerModel.setProperty(`/items/${iIndex}/destinationStorageType`, '');
            this.getView().byId("inputDestinationBin").focus();
        },

        onNext: async function () {
            const oInput = this.getView().byId("inputDestinationBin");
            const iIndex = this._oScannerModel.getProperty("/currentIndex");
            const sDestBin = this._oScannerModel.getProperty(`/items/${iIndex}/destinationBin`);

            if (!sDestBin) {
                MessageToast.show("Please scan Destination Bin");
                return;
            }

            try {
                const sDestinationStorageType = await this._validateBin(oInput);
                this._oScannerModel.setProperty(
                    `/items/${iIndex}/destinationStorageType`,
                    sDestinationStorageType
                );
                this.getOwnerComponent().getRouter().navTo("DestinationBinConfirm");
            } catch (e) {
                this._oScannerModel.setProperty(`/items/${iIndex}/destinationStorageType`, "");
                MessageToast.show("Invalid Destination Bin");
            }
        },

        _validateBin: function (oInput) {
            const sBin = oInput.getValue();
            return this._checkBinWithBackend(sBin);

        },

        _checkBinWithBackend: function (sBin) {
            return new Promise((resolve, reject) => {
                const oModel = this.getView().getModel(); // OData model

                oModel.read("/StorageBinStorageTypeSet", {
                    filters: [
                        new sap.ui.model.Filter("StorageBin", "EQ", sBin)
                    ],
                    success: function (oData) {
                        if (oData.results && oData.results.length) {
                            resolve(oData.results[0].StorageTyp);
                        } else {
                            reject();
                        }
                    },
                    error: function () {
                        reject();
                    }
                });
            });
        },
        onBack: function () {


            let iIndex = this._oScannerModel.getProperty("/currentIndex");




            try {

                let isSameDBinModeOn = this.getOwnerComponent().getModel("appModel").getProperty("/sameDBin");

                // Mark current item done
                this._oScannerModel.setProperty(`/items/${iIndex}/confirmed`, false);

                iIndex--;

                // More batches to process
                if (iIndex > -1 && isSameDBinModeOn == false) {
                    this._oScannerModel.setProperty("/currentIndex", iIndex);
                    this.getOwnerComponent().getRouter().navTo("DestinationBinConfirm");
                }
                // All done
                else {
                    const oRoute = this.getOwnerComponent().getRouter();
                    oRoute.navTo("RouteMain");
                }

            } catch (e) {
                // this._oScannerModel.setProperty(`/items/${iIndex}/destinationStorageType`, "");
                MessageToast.show("Invalid Destination Bin");
            }















        }
    });
});