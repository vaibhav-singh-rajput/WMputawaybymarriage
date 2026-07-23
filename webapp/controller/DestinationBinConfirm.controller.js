sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
], (Controller, JSONModel, MessageToast, Fragment) => {
    "use strict";

    return Controller.extend("com.triumph.putawaybymarriage.controller.DestinationBinConfirm", {
        onInit: function () {
            console.log("onInit-DestinationBinConfirm");
            this.getOwnerComponent()
                .getRouter()
                .getRoute("DestinationBinConfirm")
                .attachPatternMatched(this._onRouteMatched, this);
        },
        _onRouteMatched: function () {
            this._oScannerModel = this.getOwnerComponent().getModel("scannerModel");
            const iIndex = this._oScannerModel.getProperty("/currentIndex");

            // 🔑 THIS is the only correct way
            this.getView().bindElement({
                path: `/items/${iIndex}`,
                model: "scannerModel"
            });

            console.log("Bound to index:", iIndex);

            //Set focus into first field of page - input of DestinationBin
            var that = this;
            this.getView().addEventDelegate({
                onAfterShow: function (evt) {
                    setTimeout(function () {
                        document.getElementById(that.getView().byId("inputDestinationBinConfirm").getFocusDomRef().id).focus();
                    }, 0);
                }
            });
        },
        onClear: function () {

            const iIndex = this._oScannerModel.getProperty("/currentIndex");
            this._oScannerModel.setProperty(`/items/${iIndex}/destinationBinConfirm`, '');
            // this._oScannerModel.setProperty(`/items/${iIndex}/destinationBinConfirmChange`, '');
            this.getView().byId("inputDestinationBinConfirm").focus();
        },
        onBack: function () {
            const oRoute = this.getOwnerComponent().getRouter();
            oRoute.navTo("DestinationBin");

        },
        onConfirm: async function () {
            let iIndex = this._oScannerModel.getProperty("/currentIndex");
            const aItems = this._oScannerModel.getProperty("/items");

            const sBin = aItems[iIndex].destinationBin;
            if (!sBin && sBin != '' && sBin == null) {
                MessageToast.show("Confirm Destination Bin");
                return;
            }


            const oInput = this.getView().byId("inputDestinationBinConfirm");
            const sDestBinConfirm = this._oScannerModel.getProperty(`/items/${iIndex}/destinationBinConfirm`);

            if (!sDestBinConfirm) {
                MessageToast.show("Please scan Destination Bin");
                return;
            }




            try {
                const sDestinationStorageType = await this._validateBin(oInput);
                // Mark current item done
                this._oScannerModel.setProperty(`/items/${iIndex}/confirmed`, true);

                iIndex++;

                // More batches to process
                if (iIndex < aItems.length) {
                    this._oScannerModel.setProperty("/currentIndex", iIndex);
                    this.getOwnerComponent().getRouter().navTo("DestinationBin");
                }
                // All done
                else {
                    this._openConfirmDialog();
                }

            } catch (e) {
                // this._oScannerModel.setProperty(`/items/${iIndex}/destinationStorageType`, "");
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






        /* =======================================================
        * DRAFT & SUBMIT
        * ======================================================= */
        _openConfirmDialog(action) {
            this._pendingAction = action;


            // Get all items from scannerModel
            const oScannerModel = this.getOwnerComponent().getModel("scannerModel");
            const allItems = oScannerModel.getProperty("/items") || [];

            const filtered = allItems.filter(item =>
                item.batch !== null &&
                item.bin !== ""
            );

            const oConfirmModel = new sap.ui.model.json.JSONModel({ items: filtered });
            this.getView().setModel(oConfirmModel, "confirmModel");

            if (!this._oConfirmDialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "com.triumph.putawaybymarriage.view.ConfirmDialog",
                    controller: this
                }).then(oDialog => {
                    this._oConfirmDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.open();
                });
            } else {
                this._oConfirmDialog.open();
            }
        },

        onConfirmOk() {
            this._oConfirmDialog.close();

            if (this._pendingAction === "draft") this._callODataSaveDraft();
            if (this._pendingAction === "submit") this._callODataSubmit();
        },

        onConfirmCancel() {
            this._oConfirmDialog.close();
        },
    });
});