sap.ui.define([
    "sap/ui/core/UIComponent",
    "com/triumph/putawaybymarriage/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("com.triumph.putawaybymarriage.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();

            // set headerWizard model
            var oHeaderWizard = new sap.ui.model.json.JSONModel({
                mode: "",

                nextButtonVisible: false,
                backButtonVisible: false,
                finishButtonVisible: false,
                plantSelectVisible: false,
                plantTextBoxVisible: true,
                searchVendorsInAllCompanyCodes: false,
                inputsDeliveryAddressEditable: false,
                messageStripDeliveryAddressOnLineItemVisible: false,
                selectedCompanyCode: "",
                selectedPlant: ""
            });
            this.setModel(oHeaderWizard, "headerWizardModel");

            /* =========================================================== */
            /* JSON Models                                                 */
            /* =========================================================== */
            // set image model
            var oRootPath = jQuery.sap.getModulePath("com.triumph.putawaybymarriage");
            var oImageModel = new sap.ui.model.json.JSONModel({
                path: oRootPath,
            });
            this.setModel(oImageModel, "imageModel");

            // set activity area model
            this.setModel(new sap.ui.model.json.JSONModel(), "userModel");

            // set scannerModel model
            var oPrModel = new sap.ui.model.json.JSONModel({
                scannedBatchBin: []
            });
            this.setModel(oPrModel, "scannerModel");

            // set counterModel model
            this.setModel(new sap.ui.model.json.JSONModel(), "counterModel");

        }
    });
});