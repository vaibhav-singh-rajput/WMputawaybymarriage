sap.ui.define([
    "sap/ui/core/UIComponent",
    "com/triumph/putawaybymarriage/model/models",
    "sap/ui/model/json/JSONModel",
    "com/triumph/putawaybymarriage/model/MockODataModel",
], (UIComponent, models, JSONModel, MockODataModel) => {
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
            const oScannerModel = new sap.ui.model.json.JSONModel({
                items: [],
                currentIndex: 0,
                totalCount: 0
            });

            // 🔑 THIS IS THE KEY LINE
            this.setModel(oScannerModel, "scannerModel");;

            // set counterModel model
            this.setModel(new sap.ui.model.json.JSONModel(), "counterModel");

            /* =========================================================== */
            /* Temporary JSON mock model                                    */
            /* =========================================================== */
            // Temporary JSON mock model - Should be reomoved when actual odata is ready

            const bUseMock = true; // or from config/env flag
            const oModel = bUseMock
                ? new MockODataModel(sap.ui.require.toUrl("com/triumph/putawaybymarriage/model/MockData.json"))
                : new ODataModel("/sap/opu/odata/sap/YOUR_SERVICE");//future odata

            this.setModel(oModel);

        }
    });
});