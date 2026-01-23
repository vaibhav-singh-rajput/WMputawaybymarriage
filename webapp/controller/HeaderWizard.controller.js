sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/core/ValueState"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, Filter, FilterOperator, JSONModel, MessageBox, ValueState) {
        "use strict";

        return Controller.extend("com.triumph.putawaybymarriage.controller.HeaderWizard", {

            onInit: function () {

                this.getOwnerComponent().getRouter().getRoute("HeaderWizard").attachPatternMatched(this._handleRouteMatched, this);


                // Create private variables for frequently used JSON models
                this._oWizardModel = this.getOwnerComponent().getModel("headerWizardModel");
                this._oPrModel = this.getOwnerComponent().getModel("prModel");
                this._oModel = this.getOwnerComponent().getModel();
                console.log(this._oWizardModel);
                this._oWizard = this.byId("wizardHeader");
            },

            _handleRouteMatched: function (oEvent) {

                this._iIndexPRHeader = parseInt(oEvent.getParameter("arguments").subPr);

                this._iSelectedStepIndex = 0;
                this._oSelectedStep = this._oWizard.getSteps()[this._iSelectedStepIndex];

                this._oWizard.goToStep(this._oWizard.getSteps()[this._iSelectedStepIndex]);
                this._oWizard.setCurrentStep(this._oWizard.getSteps()[this._iSelectedStepIndex]);
                console.log(this._oWizardModel);

                // Initialize/reset local models
                if (this.getView().getModel("recipientModel")) {
                    this.getView().getModel("recipientModel").setData(null);
                }

                if (this.getView().getModel("companyCodeModel")) {
                    this.getView().getModel("companyCodeModel").setData(null);
                }

                if (this.getView().getModel("vendorModel")) {
                    this.getView().getModel("vendorModel").setData(null);
                }

                this._oWizardModel.setProperty("/nextButtonVisible", true);
                this._oWizardModel.setProperty("/backButtonVisible", false);
                this._oWizardModel.setProperty("/finishButtonVisible", false);
                this._oWizardModel.setProperty("/plantSelectVisible", false);
                this._oWizardModel.setProperty("/plantTextBoxVisible", true);
                this._oWizardModel.setProperty("/searchVendorsInAllCompanyCodes", false);
                this._oWizardModel.setProperty("/inputsDeliveryAddressEditable", false);
                this._oWizardModel.setProperty("/inputsDeliveryAddressEditable", false);
                this._oWizardModel.setProperty("/messageStripDeliveryAddressOnLineItemVisible", false);

                // Switch between new PR header and edit PR header
                if (this._oPrModel.getProperty("/subPRs/" + this._iIndexPRHeader)) {
                    this._oWizardModel.setProperty("/mode", "edit");
                    console.debug("Header wizard started in edit mode");

                    this._InitializeShoppingOnBehalfStep = false;

                    // Copy PR header to edit into prHeaderModel
                    var oPRHeaderToEdit = structuredClone(this._oPrModel.getProperty("/subPRs/" + this._iIndexPRHeader));
                    this.getView().setModel(new JSONModel(oPRHeaderToEdit), "prHeaderModel");
                    this._oPRHeaderModel = this.getView().getModel("prHeaderModel");

                    // Prepare shopping on behalf step
                    this._prepareShoppingOnBehalfStepForEdit();
                    this._prepareVendorAndPOSendoutMailStepForEdit();
                    this._prepareDeliveryDateAndDocumentTypeStepForEdit();
                } else {
                    this._oWizardModel.setProperty("/mode", "create");
                    console.debug("Header wizard started in create mode");

                    // Initialize new PR Header
                    this._initializeNewPrHeader();
                    this._initializeShoppingOnBehalfStep();
                    this._initializeVendorStep();
                    this._initializeDeliveryDateAndDocumentTypeStep();
                }

                this._handleHeaderWizardButtonsVisibility();
            },

            onAfterRendering: function () {
                // disable wizard top bar navigation
                this._oWizard._getProgressNavigator().ontap = () => { };

                // Initialize message manager
                // this.createMessagePopover();

                console.log(this._oWizardModel);
            },

            /**
             * Navigate user back to launchpad
             */
            onPressButtonLogout: function () {
                this.navigateBackToLaunchpad();
            },

            onPressButtonHelp: function () {
                const sURLHelpPortal = this.getView().getModel("settingsModel").getProperty("/HELP_LINK");
                if (sURLHelpPortal) {
                    sap.m.URLHelper.redirect(sURLHelpPortal, true);
                } else {
                    MessageBox.error("Link to help page could not be loaded. Please contact an application administrator.", {
                        emphasizedAction: MessageBox.Action.CLOSE
                    });
                }
            },

            onPressButtonCancelEdit: function () {
                this.getOwnerComponent().getRouter().navTo("LineItemOverview");
            },

            /**
             * Get the index of prHeader node to be created and initialize node
             */
            _initializeNewPrHeader: function () {
                // Create model basis
                var oPRHeaderModel = {
                    label: this.getResourceBundle().getText("prHeaderNumberLabel") + " " + (this._iIndexPRHeader + 1),
                    createdOn: new Date(),
                    temporaryPRNum: null,
                    requestor: this._oPrModel.getProperty("/requestor"),
                    deliveryAddress: {
                        Name1: null,
                        Stras: null,
                        Hsnm1: null,
                        Ort01: null,
                        Pstlz: null,
                        Land1: null,
                        Land1T: null,
                        Region: null,
                        RegionT: null,
                        deliveryAddressOnLineItems: false
                    },
                    vendor: null,
                    pOSendoutToVendor: false,
                    pOSendoutToRequestor: false,
                    pOSendoutToRecipient: false,
                    recipientMail: null,
                    deliveryDates: {
                        multipleDeliveries: false,
                        deliveryDateOnLineItems: false,
                        deliveryDate: null,
                        validityStart: null,
                        validityEnd: null,
                    },
                    documentType: Constants.DOCTYPE_STANDARD,
                    notes: {
                        messageForProcurement: null,
                        messageForApprover: null,
                        messageForVendor: null
                    },
                    items: [],
                    currencyConversion: [],
                    totalValue: 0,
                    grRelevent: false,
                    amountAttachments: 0
                };

                // Request temporary PR number
                var oEntry = {
                    Nrrangenr: "01"
                };

                this._oModel.create("/TempPRNumberSet", oEntry, {
                    method: "POST",
                    success: (oData) => {
                        oPRHeaderModel.temporaryPRNum = oData.Nr;
                    },
                    error: () => {
                        MessageBox.error("Temporary PR number could not be generated. Please contact the application administrator.", {
                            actions: ["Back to Launchpad"],
                            onClose: () => {
                                this.navigateBackToLaunchpad();
                            }
                        });
                    },
                });

                this.getView().setModel(new JSONModel(oPRHeaderModel), "prHeaderModel");
                this._oPRHeaderModel = this.getView().getModel("prHeaderModel");
            },

            /**
             * Request currency conversion from SAP backend
             * @param {String} sFromCurrency 
             * @param {String} sToCurrency 
             */
            _requestCurrencyConversion: function (sFromCurrency, sToCurrency) {
                return new Promise((resolve, reject) => {
                    this._oModel.read("/ExchangeRateSet", {
                        method: "GET",
                        filters: [
                            new Filter("FromCurr", "EQ", sFromCurrency),
                            new Filter("ToCurrncy", "EQ", sToCurrency)
                        ],
                        success: (oData) => {
                            resolve(oData);
                        },
                        error: (oError) => {
                            MessageBox.error("Error during request of currency conversions. Please contact an application administrator.");
                            reject();
                        }
                    });
                });
            },

            /* =========================================================== */
            /* Recipient Step                                              */
            /* =========================================================== */

            /**
             * Initialize UI elements of recipient step
             */
            _initializeShoppingOnBehalfStep: function () {
                var oPanelRecipientSelection = this.byId("panelRecipientSelection");
                var oRadioButtonGroupBatchEntryMode = this.byId("radioButtonGroupBatchEntryMode");

                oPanelRecipientSelection.setVisible(false);
                oRadioButtonGroupBatchEntryMode.setSelectedIndex(0);
            },

            /**
             * Handel radio button selection change event for Batch Entry Mode Selection 
             * radio button group. If option Multiple Batch Entry Mode selectet, 
             * User will have max 15 input in next screen.
             */
            onRadioButtonGroupBatchEntryModeSelect: function (oEvent) {
                var iSelectedIndex = oEvent.getParameter("selectedIndex");
                var oPanelRecipientSelection = this.byId("panelRecipientSelection");

                switch (iSelectedIndex) {
                    case 0:
                        oPanelRecipientSelection.setVisible(false);
                        this._resetRecipientSearch();
                        break;
                    case 1:
                        oPanelRecipientSelection.setVisible(true);
                        break;
                }
            },

            /**
             * Handel search button press event of recipient filter bar search 
             * button and request recipient by first name and last name
             */
            onFilterBarRecipientSearch: function () {
                var sFirstName = this.byId("inputRecipientSearchFirstName").getValue();
                var sLastName = this.byId("inputRecipientSearchLastName").getValue();

                // Check if at least one parameter is set               
                if (sFirstName || sLastName) {
                    this._requestRecipients(sFirstName, sLastName);
                    this.clearMessageManager();
                } else {
                    this.createErrorMessage(
                        this.getResourceBundle().getText("wHRecipientStepErrorRecipientSearchEmpty"),
                        this.getResourceBundle().getText("wHRecipientStepErrorDetailsRecipientSearchEmpty"));
                    this.refreshMessagePopover();
                }
            },

            /**
             * Request list of recipients from Boomi oData service for active directory. 
             * Filter by first name and/or last name if provided. Result will be stored 
             * in recipientModel JSONModel.
             * @param {*} sFirstName 
             * @param {*} sLastName 
             */
            _requestRecipients: function (sFirstName, sLastName) {
                var oADModel = this.getOwnerComponent().getModel("adModel");

                var oFilter = [];
                if (sFirstName != null && sFirstName.length > 0) {
                    oFilter.push(new Filter("FN", "EQ", sFirstName));
                }
                if (sLastName != null && sLastName.length > 0) {
                    oFilter.push(new Filter("LN", "EQ", sLastName));
                }

                oADModel.read("/SmartBuy", {
                    method: "GET",
                    filters: oFilter,
                    success: (oData) => {
                        var oRecipientModel = new JSONModel(oData);
                        this.getView().setModel(oRecipientModel, "recipientModel");
                    },
                    error: (oError) => {
                        MessageBox.error("Error during request of recipient. Please contact an application administrator.");
                    }
                });
            },

            /**
             * Reset recipient search by clearing list and resetting inputs
             */
            _resetRecipientSearch: function () {
                if (this.getView().getModel("recipientModel")) {
                    this.getView().getModel("recipientModel").setData(null);
                }
                this.byId("inputRecipientSearchFirstName").setValue(null);
                this.byId("inputRecipientSearchLastName").setValue(null);
            },

            /**
             * Event handler for recipient list change event. Set selected 
             * recipient in prHeaderModel.
             */
            onSelectionChangeRecipientList: function (oEvent) {
                let oSelectedRecipient = oEvent.getSource().getSelectedItem().getBindingContext("recipientModel").getObject(),
                    oList = oEvent.getSource();


                if (oSelectedRecipient.division) {
                    this._oPRHeaderModel.setProperty("/recipient", oSelectedRecipient);
                } else {
                    const sMessage = this.getResourceBundle().getText("errorMessageRequisitionerWithoutCompanyCode") +
                        this.getView().getModel("settingsModel").getProperty("/CLIENT_PORTAL").toLowerCase();
                    MessageBox.error(sMessage, {
                        emphasizedAction: MessageBox.Action.CLOSE,
                        onClose: () => {
                            oList.removeSelections(true);
                        }
                    });
                }
            },

            /* =========================================================== */
            /* Entity and Delivery Address Step                            */
            /* =========================================================== */

            /**
             * Initialize entitiy and delivery address screen by preselecting 
             * company code based on recipient information
             */
            _initializeEntityAndDeliveryAddressStep: function () {
                this.byId("radioButtonGroupDeliveryOptions").setSelectedIndex(0);
                this.byId("selectPlant").setSelectedKey(null);

                this._loadDataCompanyCodeSelect().then(
                    (success) => {
                        var sCompanyCode = this._oPRHeaderModel.getProperty("/recipient/division");

                        var bCompanyCodeInvalid = true;

                        $.each(this.getView().getModel("companyCodeModel").oData, (index, value, array) => {
                            if (value.Bukrs === sCompanyCode) {
                                var oSelectCompanyCode = this.byId("selectCompanyCode");
                                oSelectCompanyCode.setSelectedKey(sCompanyCode);
                                oSelectCompanyCode.fireChange(oSelectCompanyCode.getSelectedItem());
                                bCompanyCodeInvalid = false;
                            }
                        });

                        if (bCompanyCodeInvalid) {
                            MessageBox.error("Company code from user data does not match to any company code exposed by SAP. Please contact an application administrator.", {
                                actions: ["Back to Launchpad"],
                                emphasizedAction: "Back to Launchpad",
                                onClose: () => {
                                    this.navigateBackToLaunchpad();
                                }
                            });

                            // Reset view in case of this error
                            this.byId("selectCompanyCode").setSelectedKey(null);
                            this.byId("selectPlant").setSelectedKey(null);
                            this._oPRHeaderModel.setProperty("/companyCode", null);
                            this._oPRHeaderModel.setProperty("/plant", null);
                            this._oWizardModel.setProperty("/plantSelectVisible", false);
                            this._oWizardModel.setProperty("/plantTextBoxVisible", true);
                        }
                    },
                    (error) => {
                        MessageBox.error("Error during request of company code. Please contact an application administrator.", {
                            actions: ["Back to Launchpad"],
                            emphasizedAction: "Back to Launchpad",
                            onClose: () => {
                                this.navigateBackToLaunchpad();
                            }
                        });
                    }
                );

                // Initialise model for country input
                this._oModel.read("/CountrySet", {
                    method: "GET",
                    success: (oData) => {
                        this.getView().setModel(new JSONModel(oData.results), "countryModel");
                    },
                    error: (oError) => {
                        MessageBox.error("Error during request of countries. Please contact an application administrator.");
                    }
                });
            },

            /**
             * Request set of company codes from backend and store it 
             * in local model which will be used by select box
             */
            _loadDataCompanyCodeSelect: function () {
                var oPromise = new Promise((resolve, reject) => {

                    this._oModel.read("/CompanySet", {
                        method: "GET",
                        success: (oData) => {
                            var oResponseModel = new JSONModel(oData.results);
                            oResponseModel.setSizeLimit(oData.results.length);
                            this.getView().setModel(oResponseModel, "companyCodeModel");

                            resolve();
                        },
                        error: (oError) => {
                            reject(oError);
                        }
                    });
                });

                return oPromise;
            },

            /**
             * Event handler for company code select. Request selected company code and store 
             * it in prHeaderModel. Request plant based on company code. If single result, store 
             * plant in prHeaderModel. In case of multiple results, fill plant select box so that 
             * user can select intended plant
             * @param {*} oEvent 
             */
            handleChangeSelectCompanyCodeEntity: function (oEvent) {
                try {
                    var sKey = oEvent.getSource().getSelectedItem().getKey();

                    this._oModel.read("/CompanySet", {
                        method: "GET",
                        filters: [
                            new Filter("Bukrs", "EQ", sKey)
                        ],
                        success: (oData) => {
                            if (oData.results.length === 1) {
                                this._oPRHeaderModel.setProperty("/companyCode", oData.results[0]);
                            } else {
                                MessageBox.error("Response of company code request returned ambiguous. Please contact an application administrator.");
                            }
                        },
                        error: (oError) => {
                            MessageBox.error("Error during request of company code. Please contact an application administrator.");
                            this._oPRHeaderModel.setProperty("/companyCode", null);
                        }
                    });

                    /**
                     * Get plant data related to selected company code. If more than one resulting plant, 
                     * plant selection select box will become visible and select box data will be set according 
                     * to oData result. Else select box will be set to invisible and resulting plant will be 
                     * set in UI
                     */
                    this._oModel.read("/PlantSet", {
                        method: "GET",
                        filters: [
                            new Filter("Bukrs", "EQ", sKey)
                        ],
                        success: (oData) => {

                            if (oData.results.length === 1) {

                                // Handle visibility of plant select and plant text box
                                this._oWizardModel.setProperty("/plantSelectVisible", false);
                                this._oWizardModel.setProperty("/plantTextBoxVisible", true);

                                this._oPRHeaderModel.setProperty("/plant", oData.results[0]);

                                this._storePlantAddressAsDeliveryAddress();
                            } else {

                                // Handle visibility of plant select and plant text box
                                this._oWizardModel.setProperty("/plantSelectVisible", true);
                                this._oWizardModel.setProperty("/plantTextBoxVisible", false);

                                this._clearDeliveryAddressInputs();

                                var oResponseModel = new JSONModel(oData.results);
                                oResponseModel.setSizeLimit(oData.results.length);
                                this.getView().setModel(oResponseModel, "plantSelectionModel");
                            }

                            this.getView().byId("radioButtonGroupDeliveryOptions").setSelectedIndex(0);
                            this.getView().byId("radioButtonGroupDeliveryOptions").fireSelect();
                        },
                        error: (oError) => {
                            MessageBox.error("Error during request of plants. Please contact an application administrator.");
                        }
                    });

                    this._initializeVendorStep();
                } catch {
                    this._oPRHeaderModel.setProperty("/companyCode", null);
                    this._oPRHeaderModel.setProperty("/plant", null);

                    this.getView().byId("radioButtonGroupDeliveryOptions").setSelectedIndex(0);
                    this.getView().byId("radioButtonGroupDeliveryOptions").fireSelect();
                }
            },

            /**
             * Event handler for plant select
             */
            handleChangeSelectPlantEntity: function (oEvent) {
                try {
                    var sKey = oEvent.getSource().getSelectedItem().getKey();
                    this._requestAndDisplayDeliveryAddress(sKey);
                } catch {
                    this._oPRHeaderModel.setProperty("/plant", null);

                    this.getView().byId("radioButtonGroupDeliveryOptions").setSelectedIndex(0);
                    this.getView().byId("radioButtonGroupDeliveryOptions").fireSelect();
                }
            },

            /**
             * Request plant information with given plant and store it into 
             * prModel. Data will be used to display information in UI
             * @param {*} sPlant 
             */
            _requestAndDisplayDeliveryAddress: function (sPlant) {
                this._oModel.read("/PlantSet", {
                    method: "GET",
                    filters: [
                        new Filter("Werks", "EQ", sPlant)
                    ],
                    success: (oData) => {
                        this._oPRHeaderModel.setProperty("/plant", oData.results[0]);

                        this._storePlantAddressAsDeliveryAddress();

                        this.getView().byId("radioButtonGroupDeliveryOptions").setSelectedIndex(0);
                        this.getView().byId("radioButtonGroupDeliveryOptions").fireSelect();
                    },
                    error: (oError) => {
                        MessageBox.error("Error during request of delivery address. Please contact an application administrator.");
                    }
                });
            },

            /**
             * Event handler for delivery option radio button group. In case of custom delivery 
             * address enable inputs and clear inputs. In case of address on line item level 
             * disable inputs and display message strip with information for user. In case of 
             * default address restore address from plantRestoreModel and disable inputs.
             * @param {*} oEvent 
             */
            onRadioButtonGroupDeliveryOptionsSelect: function (oEvent) {
                var iIndex = this.getView().byId("radioButtonGroupDeliveryOptions").getSelectedIndex();

                switch (iIndex) {
                    case 0:
                        this._oWizardModel.setProperty("/inputsDeliveryAddressEditable", false);
                        this._oWizardModel.setProperty("/messageStripDeliveryAddressOnLineItemVisible", false);
                        this._oPRHeaderModel.setProperty("/deliveryAddress/deliveryAddressOnLineItems", false);

                        this._storePlantAddressAsDeliveryAddress();

                        break;
                    case 1:
                        this._oWizardModel.setProperty("/inputsDeliveryAddressEditable", true);
                        this._oWizardModel.setProperty("/messageStripDeliveryAddressOnLineItemVisible", false);
                        this._oPRHeaderModel.setProperty("/deliveryAddress/deliveryAddressOnLineItems", false);

                        this._clearDeliveryAddressInputs();

                        break;
                    case 2:
                        this._oWizardModel.setProperty("/inputsDeliveryAddressEditable", true);
                        this._oWizardModel.setProperty("/messageStripDeliveryAddressOnLineItemVisible", true);
                        this._oPRHeaderModel.setProperty("/deliveryAddress/deliveryAddressOnLineItems", true);

                        this._clearDeliveryAddressInputs();

                        break;
                }
            },

            /**
             * Clear plant information in prModel and thus clear related inputs as well
             */
            _clearDeliveryAddressInputs: function () {
                this._oPRHeaderModel.setProperty("/deliveryAddress/Name1", "");
                this._oPRHeaderModel.setProperty("/deliveryAddress/Land1", "");
                this._oPRHeaderModel.setProperty("/deliveryAddress/Land1T", "");
                this._oPRHeaderModel.setProperty("/deliveryAddress/Ort01", "");
                this._oPRHeaderModel.setProperty("/deliveryAddress/Pstlz", "");
                this._oPRHeaderModel.setProperty("/deliveryAddress/Stras", "");
                this._oPRHeaderModel.setProperty("/deliveryAddress/Hsnm1", "");
                this._oPRHeaderModel.setProperty("/deliveryAddress/Region", "");
                this._oPRHeaderModel.setProperty("/deliveryAddress/RegionT", "");
            },

            /**
             * Store plant address from prModel into delivery address in prModel
             */
            _storePlantAddressAsDeliveryAddress: function () {
                this._oPRHeaderModel.setProperty("/deliveryAddress/Name1", this._oPRHeaderModel.getProperty("/plant/Name1"));
                this._oPRHeaderModel.setProperty("/deliveryAddress/Land1", this._oPRHeaderModel.getProperty("/plant/Land1"));
                this._oPRHeaderModel.setProperty("/deliveryAddress/Land1T", this._oPRHeaderModel.getProperty("/plant/Land1T"));
                this._oPRHeaderModel.setProperty("/deliveryAddress/Ort01", this._oPRHeaderModel.getProperty("/plant/Ort01"));
                this._oPRHeaderModel.setProperty("/deliveryAddress/Pstlz", this._oPRHeaderModel.getProperty("/plant/Pstlz"));
                this._oPRHeaderModel.setProperty("/deliveryAddress/Stras", this._oPRHeaderModel.getProperty("/plant/Stras"));
                this._oPRHeaderModel.setProperty("/deliveryAddress/Hsnm1", this._oPRHeaderModel.getProperty("/plant/Hsnm1"));
                this._oPRHeaderModel.setProperty("/deliveryAddress/Region", this._oPRHeaderModel.getProperty("/plant/Region"));
                this._oPRHeaderModel.setProperty("/deliveryAddress/RegionT", this._oPRHeaderModel.getProperty("/plant/RegionT"));
            },

            onValueHelpRequestedCountry: function (oEvent) {
                var oDialog = sap.ui.xmlfragment("com.triumph.prcreation.view.fragments.ValueHelpCountry", this);

                oDialog.setTitle(this.getResourceBundle().getText("titleDialogCountry"));

                this.getView().addDependent(oDialog);

                oDialog.bindAggregation("items", {
                    path: "countryModel>/",
                    template: new sap.m.StandardListItem({ title: "{countryModel>Land1}", description: "{countryModel>Landt}" })
                });
                oDialog.open();
            },

            onSearchValueHelpCountry: function (oEvent) {
                var sValue = oEvent.getParameter("value");

                var oFilter = new Filter([
                    new sap.ui.model.Filter("Land1", FilterOperator.Contains, sValue),
                    new sap.ui.model.Filter("Landt", FilterOperator.Contains, sValue)],
                    false);
                var oBinding = oEvent.getParameter("itemsBinding");

                oBinding.filter([oFilter]);
            },

            onCloseValueHelpCountry: function (oEvent) {
                var oSelectedItem = oEvent.getParameter("selectedItem");
                var oInput = this.byId("inputCountry");

                if (!oSelectedItem) {
                    oInput.resetProperty("value");
                    this._oPRHeaderModel.setProperty("/deliveryAddress/Land1", null);
                    this._oPRHeaderModel.setProperty("/deliveryAddress/Land1T", null);
                } else {
                    this._oPRHeaderModel.setProperty("/deliveryAddress/Land1", oSelectedItem.getTitle());
                    this._oPRHeaderModel.setProperty("/deliveryAddress/Land1T", oSelectedItem.getDescription());

                    // Initialise model for region input
                    this._oModel.read("/RegionSet", {
                        method: "GET",
                        filters: [
                            new Filter(
                                "Land1",
                                "EQ",
                                oSelectedItem.getTitle())
                        ],
                        success: (oData) => {
                            var oResponseModel = new JSONModel(oData.results);
                            this.getView().setModel(oResponseModel, "regionModel");
                        },
                        error: (oError) => {
                            MessageBox.error("Error during request regions. Please contact an application administrator.");
                        }
                    });
                }
            },

            onValueHelpRequestedRegion: function (oEvent) {
                var oDialog = sap.ui.xmlfragment("com.triumph.prcreation.view.fragments.ValueHelpRegion", this);

                oDialog.setTitle(this.getResourceBundle().getText("titleDialogRegion"));

                this.getView().addDependent(oDialog);

                oDialog.bindAggregation("items", {
                    path: "regionModel>/",
                    template: new sap.m.StandardListItem({ title: "{regionModel>Regio}", description: "{regionModel>Bezei}" })
                });
                oDialog.open();
            },

            onSearchValueHelpRegion: function (oEvent) {
                var sValue = oEvent.getParameter("value");

                var oFilter = new Filter([
                    new sap.ui.model.Filter("Regio", FilterOperator.Contains, sValue),
                    new sap.ui.model.Filter("Bezei", FilterOperator.Contains, sValue)],
                    false);
                var oBinding = oEvent.getParameter("itemsBinding");

                oBinding.filter([oFilter]);
            },

            onCloseValueHelpRegion: function (oEvent) {
                var oSelectedItem = oEvent.getParameter("selectedItem");
                var oInput = this.byId("inputRegion");

                if (!oSelectedItem) {
                    oInput.resetProperty("value");
                    this._oPRHeaderModel.setProperty("/deliveryAddress/Region", null);
                    this._oPRHeaderModel.setProperty("/deliveryAddress/RegionT", null);
                } else {
                    this._oPRHeaderModel.setProperty("/deliveryAddress/Region", oSelectedItem.getTitle());
                    this._oPRHeaderModel.setProperty("/deliveryAddress/RegionT", oSelectedItem.getDescription());
                }
            },

            /* =========================================================== */
            /* Vendor Step                                                 */
            /* =========================================================== */

            _initializeVendorStep: function () {
                if (this.getView().getModel("vendorModel")) {
                    this.getView().getModel("vendorModel").setData(null);
                }

                this._oPRHeaderModel.setProperty("/vendor", null);
                this._oPRHeaderModel.setProperty("/selectedVendorCurrency", null);

                this.byId("inputVendorSearchNumber").setValue("");
                this.byId("inputVendorSearchName").setValue("");

                this.byId("wHVendorStepPanelHelp").setExpanded(false);

                this.byId("switchSearchVendorsInAllCompanyCodes").setState(false);
                this.byId("switchDisplayBlockedVendors").setState(false);
                this.byId("switchDisplayDeletedVendors").setState(false);

                this.byId("inputVendorEmail").setEnabled(false);
                this.byId("inputVendorEmail").setRequired(false);
                this.byId("inputUserEmail").setEnabled(false);
                this.byId("inputUserEmail").setRequired(false);
                this.byId("inputRecipientEmail").setEnabled(false);
                this.byId("inputRecipientEmail").setRequired(false);
            },

            /**
             * Request list of vendors with given filters and store result in local vendorModel. 
             * Vendor name and vendor number filter will only be applied if value is set. 
             * Company code will only be applied if switch for search in all company codes is 
             * set to off.
             * @param {*} sVendorNumber
             * @param {*} sVendorName
             * @param {*} sCompanyCode
             * @param {*} bBlocked
             * @param {*} bDeleted
             */
            _requestVendor: function (sVendorNumber, sVendorName, sCompanyCode, sPlant, bBlocked, bDeleted) {
                // Create filter for request
                var oFilter = [];
                oFilter.push(new Filter("Name", "EQ", sVendorName));
                if (sVendorNumber != null && sVendorNumber.length > 0) {
                    oFilter.push(new Filter("Lifnr", "EQ", sVendorNumber));
                }
                if (sPlant != null && sPlant.length > 0) {
                    oFilter.push(new Filter("Werks", "EQ", sPlant));
                }
                if (this._oWizardModel.getProperty("/searchVendorsInAllCompanyCodes")) {
                    oFilter.push(new Filter("Bukrs", "EQ", "*"));
                } else if (sCompanyCode != null && sCompanyCode.length > 0) {
                    oFilter.push(new Filter("Bukrs", "EQ", sCompanyCode));
                }
                oFilter.push(new Filter("Sperr", "EQ", bBlocked == true ? 1 : 0));
                oFilter.push(new Filter("Loevm", "EQ", bDeleted == true ? 1 : 0));

                this._oModel.read("/VendorSet", {
                    method: "GET",
                    filters: oFilter,
                    urlParameters: { "$expand": "VendorToCurrency" },
                    success: (oData) => {
                        var oVendorModel = new JSONModel(oData);

                        // Restructure vendor currencies for workflow
                        $.each(oData.results, function (index, element, array) {
                            var aVendorCurrencies = element.VendorToCurrency.results;
                            element.VendorToCurrency = aVendorCurrencies;
                        });

                        this.getView().setModel(oVendorModel, "vendorModel");
                    },
                    error: (oError) => {
                        MessageBox.error("Error during request of vendors. Please contact an application administrator.");
                    }
                });
            },

            /**
             * Event handler for refresh vendor list button. Select relevant data from
             * controls and request list of vendors with given data. Reset vendor node 
             * in prModel since selection is reverted.
             */
            onButtonPressReloadVendorList: function () {
                var sVendorNumber = this.byId("inputVendorSearchNumber").getValue();
                var sVendorName = this.byId("inputVendorSearchName").getValue();
                var sCompanyCode = this.byId("selectCompanyCodeVendor").getSelectedKey();
                var bDisplayBlockedVendors = this.byId("switchDisplayBlockedVendors").getState();
                var bDisplayDeletedVendors = this.byId("switchDisplayDeletedVendors").getState();

                // Check if mandatory filter name is filled
                if (sVendorName != null && sVendorName.length > 0) {
                    this._requestVendor(sVendorNumber, sVendorName, sCompanyCode, null, bDisplayBlockedVendors, bDisplayDeletedVendors);

                    // Reset vendor node in prModel
                    this._oPRHeaderModel.setProperty("/vendor", null);
                    this._oPRHeaderModel.setProperty("/selectedVendorCurrency", null);
                    this.resetCustomInputState(this.byId("inputVendorSearchName"));
                    this.clearMessageManager();
                } else {
                    this.createErrorMessage(
                        this.getResourceBundle().getText("wHVendorStepErrorVendorNameEmpty"),
                        this.getResourceBundle().getText("wHVendorStepErrorVendorNameEmptyField"));
                    this.byId("inputVendorSearchName").setValueState(ValueState.Error);
                    this.byId("inputVendorSearchName").setValueStateText(this.getResourceBundle().getText("wHVendorStepErrorVendorNameEmpty"));
                    this.refreshMessagePopover();
                }
            },

            /**
             * Event handler for search vendor list button. Select relevant data from
             * controls and request list of vendors with given data. Reset vendor node 
             * in prModel since selection is reverted.
             */
            onFilterBarVendorSearch: function () {
                var sVendorNumber = this.byId("inputVendorSearchNumber").getValue();
                var sVendorName = this.byId("inputVendorSearchName").getValue();
                var sPlant = this._oPRHeaderModel.getProperty("/plant/Werks");
                var bDisplayBlockedVendors = this.byId("switchDisplayBlockedVendors").getState();
                var bDisplayDeletedVendors = this.byId("switchDisplayDeletedVendors").getState();

                // Check if mandatory filter name is filled
                if (sVendorName != null && sVendorName.length > 0) {
                    this._requestVendor(sVendorNumber, sVendorName, null, sPlant, bDisplayBlockedVendors, bDisplayDeletedVendors);

                    // Reset vendor node in prModel
                    this._oPRHeaderModel.setProperty("/vendor", null);
                    this._oPRHeaderModel.setProperty("/selectedVendorCurrency", null);
                    this.resetCustomInputState(this.byId("inputVendorSearchName"));
                    this.clearMessageManager();
                } else {
                    this.createErrorMessage(
                        this.getResourceBundle().getText("wHVendorStepErrorVendorNameEmpty"),
                        this.getResourceBundle().getText("wHVendorStepErrorVendorNameEmptyField"));
                    this.byId("inputVendorSearchName").setValueState(ValueState.Error);
                    this.byId("inputVendorSearchName").setValueStateText(this.getResourceBundle().getText("wHVendorStepErrorVendorNameEmpty"));
                    this.refreshMessagePopover();
                }
            },

            /**
             * Event handler for vendor list selection change. If vendor is blocked, 
             * marked for deletion or assigned to another company code than recipient, 
             * create error message and remove list selection. Else store vendor data 
             * in local prModel and set visibility of vendor email
             */
            onSelectionChangeVendorList: function (oEvent) {
                var oSelectedVendor = oEvent.getSource().getSelectedItem().getBindingContext("vendorModel").getObject();

                /** 
                 * If vendor blocked and/or marked for deletion or not assigned 
                 * to recipients company code inform user that vendor is not 
                 * selectable and undo selection
                 */
                if (oSelectedVendor.Loevm && oSelectedVendor.Sperr) {
                    this.oMessageManager.removeAllMessages();
                    this.createErrorMessage(
                        this.getResourceBundle().getText("wHVendorStepErrorBlockedAndDeletedVendorSelected"),
                        this.getResourceBundle().getText("wHVendorStepErrorBlockedAndDeletedVendorSelectedDetails"));
                    this.refreshMessagePopover();

                    this.byId("listVendorSelectionWizard").removeSelections(true);
                } else if (oSelectedVendor.Loevm) {
                    this.oMessageManager.removeAllMessages();
                    this.createErrorMessage(
                        this.getResourceBundle().getText("wHVendorStepErrorDeletedVendorSelected"),
                        this.getResourceBundle().getText("wHVendorStepErrorDeletedVendorSelectedDetails"));
                    this.refreshMessagePopover();

                    this.byId("listVendorSelectionWizard").removeSelections(true);
                } else if (oSelectedVendor.Sperr) {
                    this.oMessageManager.removeAllMessages();
                    this.createErrorMessage(
                        this.getResourceBundle().getText("wHVendorStepErrorBlockedVendorSelected"),
                        this.getResourceBundle().getText("wHVendorStepErrorBlockedVendorSelectedDetails"));
                    this.refreshMessagePopover();

                    this.byId("listVendorSelectionWizard").removeSelections(true);
                } else if (oSelectedVendor.Bukrs !== this._oPRHeaderModel.getProperty("/companyCode/Bukrs")) {
                    this.oMessageManager.removeAllMessages();
                    this.createErrorMessage(
                        this.getResourceBundle().getText("wHVendorStepErrorVendorFromOtherCompanyCode"),
                        this.getResourceBundle().getText("wHVendorStepErrorVendorFromOtherCompanyCodeDetails"));
                    this.refreshMessagePopover();

                    this.byId("listVendorSelectionWizard").removeSelections(true);
                } else {
                    this._oPRHeaderModel.setProperty("/vendor", oSelectedVendor);

                    // Reset vendor email form inputs
                    var oInputVendorEmail = this.byId("inputVendorEmail");
                    var oInputUserEmail = this.byId("inputUserEmail");
                    var oInputRecipientEmail = this.byId("inputRecipientEmail");

                    oInputVendorEmail.setEnabled(false);
                    oInputVendorEmail.setRequired(false);
                    oInputUserEmail.setEnabled(false);
                    oInputUserEmail.setRequired(false);
                    oInputRecipientEmail.setEnabled(false);
                    oInputRecipientEmail.setRequired(false);

                    oInputVendorEmail.setValue(oSelectedVendor.MAdr);
                    oInputUserEmail.setValue(this._oPRHeaderModel.getProperty("/requestor/email"));
                    oInputRecipientEmail.setValue(null);

                    this.byId("checkBoxVendorMailToVendor").setSelected(false);
                    this.byId("checkBoxVendorMailToRequestor").setSelected(false);
                    this.byId("checkBoxVendorMailToRecipient").setSelected(false);

                    // Scroll to PO sendout selection (workaround because native scrolling is not working)
                    if (this._oPRHeaderModel.getProperty("/vendor/VendorToCurrency").length <= 1) {
                        setTimeout(() => {
                            var oContainerWizardStepVendor = document.getElementById(document.getElementById(this.byId("wizardHeaderVendorSelection").getId()).parentElement.id);
                            oContainerWizardStepVendor.scrollTop = oContainerWizardStepVendor.scrollHeight;
                        }, 50);
                    }
                }

                // Reset value state and value state text of PO sendout inputs
                this._resetMailForPoInputErrorState();
            },

            onSelectCheckBoxMailToVendor: function (oEvent) {
                var bSelected = oEvent.getParameter("selected");

                this.byId("inputVendorEmail").setEnabled(bSelected);
                this.byId("inputVendorEmail").setRequired(bSelected);

                this._oPRHeaderModel.setProperty("/pOSendoutToVendor", bSelected);

                // Reset inputs to original values
                if (!bSelected) {
                    this.byId("inputVendorEmail").setValue(this._oPRHeaderModel.getProperty("/vendor/MAdr"));
                }

                // Reset value state and value state text of PO sendout inputs
                this._resetMailForPoInputErrorState();
            },

            onSelectCheckBoxMailToRequestor: function (oEvent) {
                var bSelected = oEvent.getParameter("selected");

                this.byId("inputUserEmail").setEnabled(bSelected);
                this.byId("inputUserEmail").setRequired(bSelected);

                this._oPRHeaderModel.setProperty("/pOSendoutToRequestor", bSelected);

                // Reset inputs to original values
                if (!bSelected) {
                    this.byId("inputUserEmail").setValue(this._oPRHeaderModel.getProperty("/requestor/email"));
                }

                // Reset value state and value state text of PO sendout inputs
                this._resetMailForPoInputErrorState();
            },

            onSelectCheckBoxMailToRecipient: function (oEvent) {
                var bSelected = oEvent.getParameter("selected");

                this.byId("inputRecipientEmail").setEnabled(bSelected);
                this.byId("inputRecipientEmail").setRequired(bSelected);

                this._oPRHeaderModel.setProperty("/pOSendoutToRecipient", bSelected);

                // Reset inputs to original values
                if (!bSelected) {
                    this.byId("inputRecipientEmail").setValue(this._oPRHeaderModel.getProperty("/recipientMail"));
                }

                // Reset value state and value state text of PO sendout inputs
                this._resetMailForPoInputErrorState();
            },

            /**
             * Reset value state and value state text of vendor and recipient email inputs
             */
            _resetMailForPoInputErrorState: function () {
                this.resetCustomInputState(this.byId("inputVendorEmail"));
                this.resetCustomInputState(this.byId("inputUserEmail"));
                this.resetCustomInputState(this.byId("inputRecipientEmail"));
            },

            onSelectionChangeVendorCurrency: function (oEvent) {
                this.resetCustomInputState(oEvent.getSource());

                // Scroll to PO sendout selection (workaround because native scrolling is not working)
                setTimeout(() => {
                    var oContainerWizardStepVendor = document.getElementById(document.getElementById(this.byId("wizardHeaderVendorSelection").getId()).parentElement.id);
                    oContainerWizardStepVendor.scrollTop = oContainerWizardStepVendor.scrollHeight;
                }, 50);
            },

            /* =========================================================== */
            /* Delivery Date and Document Type Step                        */
            /* =========================================================== */

            _initializeDeliveryDateAndDocumentTypeStep: function () {
                this.resetCustomInputState(this.getView().byId("datePickerWizardDeliverDateOneTimeDeliveryDate"));
                this.resetCustomInputState(this.getView().byId("datePickerWizardDeliverDateMultipleDeliveriesFromDate"));
                this.resetCustomInputState(this.getView().byId("datePickerWizardDeliverDateMultipleDeliveriesToDate"));

                this._oWizardModel.setProperty("/multipleDeliveriesSelected", false);

                this.byId("checkBoxDocumentTypeFramework").setSelected(false);
                this.byId("checkBoxDocumentTypeBlanket").setSelected(false);
                this.byId("checkBoxDocumentTypeStandard").setSelected(false);
            },

            /**
             * Handles checkbox selection property of checkbox for multiple deliveries if one time delivery checkbox is selected and resets controls of 
             * multiple deliveries option
             * @param {*} oEvent 
             */
            handleRadioButtonOneTimeDeliveryPress: function (oEvent) {
                this._oWizardModel.setProperty("/multipleDeliveriesSelected", !oEvent.getParameter('selected'));

                this._oPRHeaderModel.setProperty("/documentType", Constants.DOCTYPE_STANDARD);

                // Reset controls of multiple deliveries option
                this._oPRHeaderModel.setProperty("/deliveryDates/validityStart", null);
                this._oPRHeaderModel.setProperty("/deliveryDates/validityEnd", null);


                this.byId("datePickerWizardDeliverDateMultipleDeliveriesFromDate").setValueState(sap.ui.core.ValueState.None);
                this.byId("datePickerWizardDeliverDateMultipleDeliveriesToDate").setValueState(sap.ui.core.ValueState.None);

                this.oMessageManager.removeAllMessages();
            },

            /**
             * Handles checkbox selection property of checkbox for one time delivery if multiple deliveries checkbox is selected and resets controls of 
             * one time delivery option
             * @param {*} oEvent 
             */
            handleRadioButtonMultipleDeliveriesPress: function (oEvent) {
                this._oWizardModel.setProperty("/multipleDeliveriesSelected", oEvent.getParameter('selected'));

                // Reset controls of one time delivery option
                this._oPRHeaderModel.setProperty("/deliveryDates/deliveryDate", null);
                this._oPRHeaderModel.setProperty("/deliveryDates/deliveryDateOnLineItems", false);

                this.byId("checkBoxDocumentTypeFramework").setSelected(false);
                this.byId("checkBoxDocumentTypeBlanket").setSelected(false);
                this.byId("checkBoxDocumentTypeStandard").setSelected(false);

                this.byId("datePickerWizardDeliverDateOneTimeDeliveryDate").setValueState(sap.ui.core.ValueState.None);

                this.oMessageManager.removeAllMessages();
            },

            handleCheckboxDifferentDatesSelected: function (oEvent) {
                if (oEvent.getParameter('selected')) {
                    this._oPRHeaderModel.setProperty("/deliveryDates/deliveryDate", null);
                }
            },

            onSelectCheckBoxFramework: function (oEvent) {
                if (oEvent.getParameter("selected")) {
                    // Uncheck other options
                    this.byId("checkBoxDocumentTypeBlanket").setSelected(false);
                    this.byId("checkBoxDocumentTypeStandard").setSelected(false);

                    this._oPRHeaderModel.setProperty("/documentType", Constants.DOCTYPE_FRAMEWORK);
                }
            },

            onSelectCheckBoxBlanket: function (oEvent) {
                if (oEvent.getParameter("selected")) {
                    // Uncheck other options
                    this.byId("checkBoxDocumentTypeFramework").setSelected(false);
                    this.byId("checkBoxDocumentTypeStandard").setSelected(false);

                    this._oPRHeaderModel.setProperty("/documentType", Constants.DOCTYPE_BLANKED);
                }
            },

            onSelectCheckBoxStandard: function (oEvent) {
                if (oEvent.getParameter("selected")) {
                    // Uncheck other options
                    this.byId("checkBoxDocumentTypeFramework").setSelected(false);
                    this.byId("checkBoxDocumentTypeBlanket").setSelected(false);
                    this.byId("checkBoxDocumentTypeStandard").setSelected(false);

                    this._oPRHeaderModel.setProperty("/documentType", Constants.DOCTYPE_BLANKED);

                    // Reset inputs
                    this._oPRHeaderModel.setProperty("/deliveryDates/multipleDeliveries", false);
                    this._oPRHeaderModel.setProperty("/deliveryDates/validityStart", null);
                    this._oPRHeaderModel.setProperty("/deliveryDates/validityEnd", null);
                }
            },

            onChangeDeliveryDate: function (oEvent) {
                var oDate = oEvent.getSource().getDateValue();
                var oCurrentDate = new Date();
                oCurrentDate.setHours(0);
                oCurrentDate.setMinutes(0);
                oCurrentDate.setSeconds(0);
                oCurrentDate.setMilliseconds(0);

                if (oDate && (oDate < oCurrentDate)) {
                    this.createWarningMessage(
                        this.getResourceBundle().getText("errorStateTextDateInPast"),
                        this.getResourceBundle().getText("errorStateTextDateInPastDetails"));

                    oEvent.getSource().setValueState(sap.ui.core.ValueState.Warning);
                    oEvent.getSource().setValueStateText(this.getResourceBundle().getText("errorStateTextDateInPast"));

                    this.refreshMessagePopover();
                }

                if (oDate && (oDate.getDay() === 6 || oDate.getDay() === 0)) {
                    this.createWarningMessage(
                        this.getResourceBundle().getText("errorStateTextDateOnWeekend"),
                        this.getResourceBundle().getText("errorStateTextDateOnWeekendDetails"));

                    oEvent.getSource().setValueState(sap.ui.core.ValueState.Warning);
                    oEvent.getSource().setValueStateText(this.getResourceBundle().getText("errorStateTextDateOnWeekend"));

                    this.refreshMessagePopover();
                }
            },



            /* =========================================================== */
            /* Wizard Navigation and Validation                            */
            /* =========================================================== */

            /**
             * Sets index of current step according to change event
             * @param {*} oEvent 
             */
            handleHeaderWizardNavigationChange: function (oEvent) {
                this._oSelectedStep = oEvent.getParameter("step");
                this._iSelectedStepIndex = this._oWizard.getSteps().indexOf(this._oSelectedStep);
                this._handleHeaderWizardButtonsVisibility();
            },

            _handleHeaderWizardButtonsVisibility: function () {
                switch (this._iSelectedStepIndex) {
                    case 0:
                        this._oWizardModel.setProperty("/nextButtonVisible", true);
                        this._oWizardModel.setProperty("/backButtonVisible", false);
                        this._oWizardModel.setProperty("/finishButtonVisible", false);
                        break;
                    case 1:
                        this._oWizardModel.setProperty("/nextButtonVisible", true);
                        this._oWizardModel.setProperty("/backButtonVisible", true);
                        this._oWizardModel.setProperty("/finishButtonVisible", false);
                        break;
                    case 2:
                        this._oWizardModel.setProperty("/nextButtonVisible", true);
                        this._oWizardModel.setProperty("/backButtonVisible", true);
                        this._oWizardModel.setProperty("/finishButtonVisible", false);
                        break;
                    case 3:
                        this._oWizardModel.setProperty("/nextButtonVisible", true);
                        this._oWizardModel.setProperty("/backButtonVisible", true);
                        this._oWizardModel.setProperty("/finishButtonVisible", false);
                        break;
                    case 4:
                        this._oWizardModel.setProperty("/nextButtonVisible", false);
                        this._oWizardModel.setProperty("/backButtonVisible", true);
                        this._oWizardModel.setProperty("/finishButtonVisible", true);
                        break;
                    default: break;
                }
            },

            onPressHeaderWizardBackButton: function (oEvent) {
                this._iSelectedStepIndex = this._oWizard.getSteps().indexOf(this._oSelectedStep);
                var oPreviousStep = this._oWizard.getSteps()[this._iSelectedStepIndex - 1];

                if (this._oSelectedStep) {
                    this._oWizard.goToStep(oPreviousStep, true);
                } else {
                    this._oWizard.previousStep();
                }

                this._iSelectedStepIndex--;
                this._oSelectedStep = oPreviousStep;

                this._handleHeaderWizardButtonsVisibility();
            },

            /**
             * Button handler wizard next step
             */
            onPressHeaderWizardNextButton: async function (oEvent) {
                this._iSelectedStepIndex = this._oWizard.getSteps().indexOf(this._oSelectedStep);
                var oNextStep = this._oWizard.getSteps()[this._iSelectedStepIndex + 1];

                // this.oMessageManager.removeAllMessages();

                // this.oMessageManager.getMessageModel().getData().forEach((oMessage) => {
                //     this.oMessageManager.removeMessages(oMessage);
                // });

                /* =========================================================== */
                /* Validate Recipient Step                                     */
                /* =========================================================== */
                if (this._iSelectedStepIndex == 0) {
                    var oRadioButtonGroupBatchEntryMode = this.byId("radioButtonGroupBatchEntryMode");

                    // Users selected shopping on behalf option
                    if (oRadioButtonGroupBatchEntryMode.getSelectedIndex() == 1) {
                        var oRecipientList = this.byId("listRecipientSelectionWizard");

                        // No recipient selected
                        if (oRecipientList.getSelectedItem() == null) {
                            this.createErrorMessage(
                                this.getResourceBundle().getText("wHRecipientStepError"),
                                this.getResourceBundle().getText("wHRecipientStepErrorDetails"));
                            this.refreshMessagePopover();
                            return;
                        }
                    } else {
                        // In case no shopping on behalf user is selected, set requestor as recipient
                        this._oPRHeaderModel.setProperty("/recipient", this.getOwnerComponent().getModel("userModel").oData);
                    }

                    // Clean up recipient step
                    this.byId("inputRecipientSearchFirstName").setValue("");
                    this.byId("inputRecipientSearchLastName").setValue("");

                    // Initialize/prepare next step
                    if (this._oPRHeaderModel.getProperty("/recipient/email") !== this._oPrModel.getProperty("/subPRs/" + this._iIndexPRHeader + "/recipient/email") ||
                        this._oPRHeaderModel.getProperty("/mode") === "create") {
                        this._InitializeShoppingOnBehalfStep = true;
                    }

                    if (this._InitializeShoppingOnBehalfStep) {
                        // Has changed
                        this._initializeEntityAndDeliveryAddressStep();
                    } else {
                        // Has not changed
                        this._prepareEntityDeliveryAddressStepForEdit();
                    }
                }

                /* =========================================================== */
                /* Validates Entity and Deliver Address Step                   */
                /* =========================================================== */
                if (this._iSelectedStepIndex == 1) {
                    if (!this._validator.validate(this.byId("wizardHeaderEntity"))) {
                        this.refreshMessagePopover();
                        return;
                    } else {
                        // request and store currency conversion for company code currency to CHF
                        await this._requestCurrencyConversion("CHF", this._oPRHeaderModel.getProperty("/companyCode/Waers")).then(
                            (oData) => {
                                try {
                                    if (oData.results.length > 0) {
                                        var oResults = oData.results.map((element) => {
                                            if (!(element.FromCurr && element.ToCurrncy && element.ExchRate)) {
                                                throw new Error("Currency conversion (company code to CHF) failed because of missing response property. Please contact an application administrator.");
                                            }

                                            return {
                                                fromCurrency: element.FromCurr,
                                                toCurrency: element.ToCurrncy,
                                                factor: element.ExchRate
                                            }
                                        });

                                        this._oPRHeaderModel.setProperty("/currencyConversion/0", oResults[0]);
                                    } else {
                                        throw new Error("Currency conversion (company code to CHF) failed because of empty response. Please contact an application administrator.");
                                    }
                                } catch (oError) {
                                    console.error(oError.message)
                                    MessageBox.error("Error during processing of currency conversion (company code currency to CHF). Please contact an application administrator.");
                                    return;
                                }
                            }
                        )
                    }
                }

                /* =========================================================== */
                /* Validates Vendor and Vendor Email Step                      */
                /* =========================================================== */
                if (this._iSelectedStepIndex == 2) {
                    var oVendorList = this.byId("listVendorSelectionWizard");
                    var oInputVendorEmail = this.byId("inputVendorEmail");
                    var oInputUserEmail = this.byId("inputUserEmail");
                    var oInputRecipientEmail = this.byId("inputRecipientEmail");
                    var oCheckBoxVendorMail = this.byId("checkBoxVendorMailToVendor");
                    var oCheckBoxUserMail = this.byId("checkBoxVendorMailToRequestor");
                    var oCheckBoxRecipientMail = this.byId("checkBoxVendorMailToRecipient");
                    var sInputVendorEmail = this.byId("inputVendorEmail").getValue();
                    var sInputUserEmail = this.byId("inputUserEmail").getValue();
                    var sInputRecipientEmail = this.byId("inputRecipientEmail").getValue();

                    var bVendorWithMulipleCurrencies = false;
                    var oSelectedVendorCurrency = null;

                    // Validates if vendor selected
                    if (oVendorList.getSelectedItem() == null) {
                        this.createErrorMessage(
                            this.getResourceBundle().getText("wHVendorStepErrorNoVendorSelected"),
                            this.getResourceBundle().getText("wHVendorStepErrorNoVendorSelectedDetails"));
                        this.refreshMessagePopover();
                        return;
                    } else {
                        var validationFailed = 0;

                        // Checks if currency is selected in case multiple currencies are selectable
                        var oSelectedVendorListItem = oVendorList.getSelectedItem();

                        if (oSelectedVendorListItem.getBindingContext("vendorModel").getObject().VendorToCurrency.length > 1) {
                            bVendorWithMulipleCurrencies = true;

                            /**
                             * Get selected vendor currency selection control by iterating trough custom list item by using classes as identifier
                             */
                            var oVendorCurrencySelect = null;
                            oSelectedVendorListItem.getContent().forEach((oElement) => {
                                if (oElement.hasStyleClass("hboxVendorSelection")) {
                                    oElement.getItems().forEach((oInnerElement) => {
                                        if (oInnerElement.hasStyleClass("selectVendorCurrency")) {
                                            oVendorCurrencySelect = oInnerElement;
                                        }
                                    });
                                }
                            });

                            if (oVendorCurrencySelect.getSelectedItem() == null) {
                                this.createErrorMessage(
                                    this.getResourceBundle().getText("wHVendorStepErrorVendorCurrencyNotSelected"),
                                    this.getResourceBundle().getText("wHVendorStepErrorVendorCurrencyNotSelectedDetails"));

                                this.setCustomInputError(oVendorCurrencySelect, this.getResourceBundle().getText("customValueStateTextNoCurrencySelected"));

                                validationFailed++;
                            } else {
                                oSelectedVendorCurrency = oVendorCurrencySelect.getSelectedKey();
                            }
                        }

                        // Validate if at least one mail option is checked
                        if (!oCheckBoxVendorMail.getSelected() & !oCheckBoxUserMail.getSelected() & !oCheckBoxRecipientMail.getSelected()) {
                            this.createErrorMessage(
                                this.getResourceBundle().getText("wHVendorStepErrorNoMailOptionSelected"),
                                this.getResourceBundle().getText("wHVendorStepErrorNoMailOptionSelectedDetails"));

                            validationFailed++;
                        }

                        // Validate vendor mail entered by user
                        if (oCheckBoxVendorMail.getSelected()) {
                            if (sInputVendorEmail == null || sInputVendorEmail.length <= 0) {
                                this.createErrorMessage(
                                    this.getResourceBundle().getText("wHVendorStepErrorVendorEmailEmpty"),
                                    this.getResourceBundle().getText("wHVendorStepErrorVendorEmailEmptyDetails"));

                                this.setCustomInputError(oInputVendorEmail, this.getResourceBundle().getText("valueStateTextInvalidEmail"));

                                validationFailed++;
                            } else if (!this.validateEmailAddress(sInputVendorEmail)) {
                                this.createErrorMessage(
                                    this.getResourceBundle().getText("wHVendorStepErrorVendorEmailInvalid"),
                                    this.getResourceBundle().getText("wHVendorStepErrorVendorEmailInvalidDetails"));

                                this.setCustomInputError(oInputVendorEmail, this.getResourceBundle().getText("valueStateTextInvalidEmail"));

                                validationFailed++;
                            }
                        }

                        // Validate requestor mail entered by user
                        if (oCheckBoxUserMail.getSelected()) {
                            if (sInputUserEmail == null || sInputUserEmail.length <= 0) {
                                this.createErrorMessage(
                                    this.getResourceBundle().getText("wHVendorStepErrorRequestorEmailEmpty"),
                                    this.getResourceBundle().getText("wHVendorStepErrorRequestorEmailEmptyDetails"));

                                this.setCustomInputError(oInputUserEmail, this.getResourceBundle().getText("valueStateTextInvalidEmail"));

                                validationFailed++;
                            } else if (!this.validateEmailAddress(sInputUserEmail)) {
                                this.createErrorMessage(
                                    this.getResourceBundle().getText("wHVendorStepErrorRequestorEmailInvalid"),
                                    this.getResourceBundle().getText("wHVendorStepErrorRequestorEmailInvalidDetails"));

                                this.setCustomInputError(oInputUserEmail, this.getResourceBundle().getText("valueStateTextInvalidEmail"));

                                validationFailed++;
                            }
                        }

                        // Validate recipient mail entered by user
                        if (oCheckBoxRecipientMail.getSelected()) {
                            if (sInputRecipientEmail == null || sInputRecipientEmail.length <= 0) {
                                this.createErrorMessage(
                                    this.getResourceBundle().getText("wHVendorStepErrorRecipientEmailEmpty"),
                                    this.getResourceBundle().getText("wHVendorStepErrorRecipientEmailEmptyDetails"));

                                this.setCustomInputError(oInputRecipientEmail, this.getResourceBundle().getText("valueStateTextInvalidEmail"));

                                validationFailed++;
                            } else if (!this.validateEmailAddress(sInputRecipientEmail)) {
                                this.createErrorMessage(
                                    this.getResourceBundle().getText("wHVendorStepErrorRecipientEmailInvalid"),
                                    this.getResourceBundle().getText("wHVendorStepErrorRecipientEmailInvalidDetails"));

                                this.setCustomInputError(oInputRecipientEmail, this.getResourceBundle().getText("valueStateTextInvalidEmail"));

                                validationFailed++;
                            }
                        }

                        // Validate if next step can be entered
                        if (validationFailed > 0) {
                            this.refreshMessagePopover();
                            return;
                        } else {
                            // Reset value state and value state text of PO sendout inputs
                            this._resetMailForPoInputErrorState();

                            // Set entered mail addresses in prHeaderModel
                            this._oPRHeaderModel.setProperty("/vendor/MAdr", this.byId("inputVendorEmail").getValue());
                            this._oPRHeaderModel.setProperty("/requestor/email", this.byId("inputUserEmail").getValue());
                            this._oPRHeaderModel.setProperty("/recipientMail", this.byId("inputRecipientEmail").getValue());

                            // In case of multiple currencies for selected vendor set selected key for select control as /selectedVendorCurrency, else set unambiguously vendor key
                            if (bVendorWithMulipleCurrencies) {
                                this._oPRHeaderModel.setProperty("/selectedVendorCurrency", oSelectedVendorCurrency);
                            } else {
                                this._oPRHeaderModel.setProperty("/selectedVendorCurrency", oSelectedVendorListItem.getBindingContext("vendorModel").getObject().VendorToCurrency[0].WaeS);
                            }

                            // request and store currency conversion for vendor currency to company code currency
                            await this._requestCurrencyConversion(this._oPRHeaderModel.getProperty("/selectedVendorCurrency"), this._oPRHeaderModel.getProperty("/companyCode/Waers")).then(
                                (oData) => {
                                    try {
                                        if (oData.results.length > 0) {
                                            var oResults = oData.results.map((element) => {
                                                if (!(element.FromCurr && element.ToCurrncy && element.ExchRate)) {
                                                    throw new Error("Currency conversion (vendor to company code) failed because of missing response property. Please contact an application administrator.");
                                                }

                                                return {
                                                    fromCurrency: element.FromCurr,
                                                    toCurrency: element.ToCurrncy,
                                                    factor: element.ExchRate
                                                }
                                            });

                                            this._oPRHeaderModel.setProperty("/currencyConversion/1", oResults[0]);
                                        } else {
                                            throw new Error("Currency conversion (vendor to company code) failed because of empty response. Please contact an application administrator.");
                                        }
                                    } catch (oError) {
                                        console.error(oError.message);
                                        MessageBox.error("Error during processing of currency conversion (vendor currency to company code currency). Please contact an application administrator.");
                                        return;
                                    }
                                }
                            )

                            // request and store currency conversion for vendor currency to CHF
                            await this._requestCurrencyConversion(this._oPRHeaderModel.getProperty("/selectedVendorCurrency"), "CHF").then(
                                (oData) => {
                                    try {
                                        if (oData.results.length > 0) {
                                            var oResults = oData.results.map((element) => {
                                                if (!(element.FromCurr && element.ToCurrncy && element.ExchRate)) {
                                                    throw new Error("Currency conversion (vendor to CHF) failed because of missing response property. Please contact an application administrator.");
                                                }

                                                return {
                                                    fromCurrency: element.FromCurr,
                                                    toCurrency: element.ToCurrncy,
                                                    factor: element.ExchRate
                                                }
                                            });

                                            this._oPRHeaderModel.setProperty("/currencyConversion/2", oResults[0]);
                                        } else {
                                            throw new Error("Currency conversion (vendor to CHF) failed because of empty response. Please contact an application administrator.");
                                        }
                                    } catch (oError) {
                                        console.error(oError.message)
                                        MessageBox.error("Error during processing of currency conversion (vendor currency to CHF). Please contact an application administrator.");
                                        return;
                                    }
                                }
                            )
                        }
                    }
                }

                /* =========================================================== */
                /* Validates Delivery Date and Document Type Step              */
                /* =========================================================== */
                if (this._iSelectedStepIndex == 3) {
                    var iErrors = 0;

                    if (!this._validator.validate(this.byId("wizardHeaderDeliveryDateDocType"))) {
                        this.refreshMessagePopover();
                        iErrors++;
                    }

                    if (this._oPRHeaderModel.getProperty("/deliveryDates/multipleDeliveries")) {
                        var oDatePickerValidityStart = this.getView().byId("datePickerWizardDeliverDateMultipleDeliveriesFromDate");
                        var oDatePickerValidityEnd = this.getView().byId("datePickerWizardDeliverDateMultipleDeliveriesToDate");

                        if (oDatePickerValidityStart.getDateValue() > oDatePickerValidityEnd.getDateValue()) {
                            this.createErrorMessage(
                                this.getResourceBundle().getText("wHDeliveryDateDocTypeStepErrorValidityStartGreaterValidityEnd"),
                                this.getResourceBundle().getText("wHDeliveryDateDocTypeStepErrorValidityStartGreaterValidityEndDetails"));
                            this.refreshMessagePopover();

                            this.setCustomInputError(oDatePickerValidityStart, this.getResourceBundle().getText("valueStateTextInvalidDate"));
                            this.setCustomInputError(oDatePickerValidityEnd, this.getResourceBundle().getText("valueStateTextInvalidDate"));

                            this.refreshMessagePopover();
                            iErrors++;
                        }

                        // Check if at least one option for document type is selected
                        if (!this.byId("checkBoxDocumentTypeFramework").getSelected() & !this.byId("checkBoxDocumentTypeBlanket").getSelected() & !this.byId("checkBoxDocumentTypeStandard").getSelected()) {
                            this.createErrorMessage(
                                this.getResourceBundle().getText("wHDeliveryDateDocTypeStepErrorMissingDocumentTypeSelection"),
                                this.getResourceBundle().getText("wHDeliveryDateDocTypeStepErrorMissingDocumentTypeSelectionDetails"));
                            this.refreshMessagePopover();
                            iErrors++;
                        }
                    }

                    if (iErrors > 0) {
                        return;
                    }
                }

                if (this._oSelectedStep && !this._oSelectedStep.bLast) {
                    this._oWizard.goToStep(oNextStep, true);
                } else {
                    this._oWizard.nextStep();
                }

                this._iSelectedStepIndex++;
                this._oSelectedStep = oNextStep;

                this._handleHeaderWizardButtonsVisibility();

                console.debug("PR model:\n", this._oPRHeaderModel.oData);
            },

            onPressHeaderWizardFinishButton: function (oEvent) {

                /* =========================================================== */
                /* Validates Notes Step                                        */
                /* =========================================================== */
                if (!this._validator.validate(this.byId("wizardHeaderNotes"))) {
                    this.refreshMessagePopover();
                    return;
                } else {
                    // Set temporary pRHeaderModel in global prModel
                    this._oPrModel.setProperty("/subPRs/" + this._iIndexPRHeader, this._oPRHeaderModel.oData);

                    if (this._oWizardModel.getProperty("/mode") === "edit") {
                        this.getOwnerComponent().getRouter().navTo("LineItemOverview");
                    } else {
                        this.getOwnerComponent().getRouter().navTo("HeaderFinished");
                    }
                }
            },

            /**
             * Navigate user back to launchpad
             */
            onPressButtonLogout: function () {
                MessageBox.confirm(this.getResourceBundle().getText("Logout.ConfirmMessage"), {
                    onClose: (oAction) => {
                        if (oAction === MessageBox.Action.OK) {
                            this.navigateBackToLaunchpad();
                        }
                    }
                });
            },

            /* =========================================================== */
            /* Edit PR Header                                              */
            /* =========================================================== */

            _prepareShoppingOnBehalfStepForEdit: function () {
                if (this._oPRHeaderModel.getProperty("/requestor/email") === this._oPRHeaderModel.getProperty("/recipient/email")) { // Shop for me
                    this.byId("panelRecipientSelection").setVisible(false);
                    this.byId("radioButtonGroupBatchEntryMode").setSelectedIndex(0);
                } else { // Shopping on behalf
                    this.byId("panelRecipientSelection").setVisible(true);
                    this.byId("radioButtonGroupBatchEntryMode").setSelectedIndex(1);

                    // Prepare recipient model for list
                    var oRecipientModel = {
                        results: [
                            this._oPRHeaderModel.getProperty("/recipient")
                        ]
                    };
                    this.getView().setModel(new JSONModel(oRecipientModel), "recipientModel");

                    // Select item in list
                    var oSelectedItem = this.byId("listRecipientSelectionWizard").getItems()[0];
                    this.byId("listRecipientSelectionWizard").setSelectedItem(oSelectedItem);
                }
            },

            _prepareEntityDeliveryAddressStepForEdit: function () {
                this._loadDataCompanyCodeSelect().then(
                    (success) => {
                        try {
                            // Select originaly selected company code 
                            var sCompanyCode = this._oPRHeaderModel.getProperty("/companyCode/Bukrs");
                            this.byId("selectCompanyCode").setSelectedKey(sCompanyCode);

                            /**
                             * Get plant data related to selected company code. If more than one resulting plant, 
                             * plant selection select box will become visible and select box data will be set according 
                             * to oData result.
                             */
                            this._oModel.read("/PlantSet", {
                                method: "GET",
                                filters: [
                                    new Filter("Bukrs", "EQ", sCompanyCode)
                                ],
                                success: (oData) => {

                                    if (oData.results.length >= 1) {
                                        // Handle visibility of plant select and plant text box
                                        this._oWizardModel.setProperty("/plantSelectVisible", true);
                                        this._oWizardModel.setProperty("/plantTextBoxVisible", false);

                                        var oResponseModel = new JSONModel(oData.results);
                                        oResponseModel.setSizeLimit(oData.results.length);
                                        this.getView().setModel(oResponseModel, "plantSelectionModel");

                                        // Select originaly selected plant
                                        var sPlant = this._oPRHeaderModel.getProperty("/plant/Werks");
                                        this.byId("selectPlant").setSelectedKey(sPlant);
                                    }
                                },
                                error: (oError) => {
                                    MessageBox.error("Error during request of plants. Please contact an application administrator.");
                                }
                            });
                        } catch {
                            MessageBox.error("Error during set of originaly selected company code. Please contact an application administrator.", {
                                actions: ["Cancel PR Edit"],
                                emphasizedAction: "Cancel PR Edit",
                                onClose: () => {
                                    this.getOwnerComponent().getRouter().navTo("LineItemOverview");
                                }
                            });
                        }
                    },
                    (error) => {
                        MessageBox.error("Error during request of company code. Please contact an application administrator.", {
                            actions: ["Cancel PR Edit"],
                            emphasizedAction: "Cancel PR Edit",
                            onClose: () => {
                                this.getOwnerComponent().getRouter().navTo("LineItemOverview");
                            }
                        });
                    }
                );

                // Initialise model for country input
                this._oModel.read("/CountrySet", {
                    method: "GET",
                    success: (oData) => {
                        this.getView().setModel(new JSONModel(oData.results), "countryModel");
                    },
                    error: (oError) => {
                        MessageBox.error("Error during request of countries. Please contact an application administrator.");
                    }
                });

                // Initialise model for region and select originally selected region in case it was selected originally
                if (this._oPRHeaderModel.getProperty("/deliveryAddress/Region") !== "") {
                    if (this._oPRHeaderModel.getProperty("/deliveryAddress/Land1") !== "") {
                        this._oModel.read("/RegionSet", {
                            method: "GET",
                            filters: [
                                new Filter(
                                    "Land1",
                                    "EQ",
                                    this._oPRHeaderModel.getProperty("/deliveryAddress/Land1")
                                )
                            ],
                            success: (oData) => {
                                var oResponseModel = new JSONModel(oData.results);
                                this.getView().setModel(oResponseModel, "regionModel");
                            },
                            error: (oError) => {
                                MessageBox.error("Error during request regions. Please contact an application administrator.");
                            }
                        });
                    } else {
                        MessageBox.error("Error during request regions because country is not set. Please contact an application administrator.");
                    }
                }

                // Set originally selected delivery address option and enabled/visible flags
                if (this._oPRHeaderModel.getProperty("/deliveryAddress/deliveryAddressOnLineItems")) {
                    this.byId("radioButtonGroupDeliveryOptions").setSelectedIndex(2);

                    this._oWizardModel.setProperty("/inputsDeliveryAddressEditable", true);
                    this._oWizardModel.setProperty("/messageStripDeliveryAddressOnLineItemVisible", true);
                    this._oPRHeaderModel.setProperty("/deliveryAddress/deliveryAddressOnLineItems", true);
                } else if (this._compareDeliveryAddresses(this._oPRHeaderModel.getProperty("/deliveryAddress"), this._oPRHeaderModel.getProperty("/plant"))) {
                    this.byId("radioButtonGroupDeliveryOptions").setSelectedIndex(0);

                    this._oWizardModel.setProperty("/inputsDeliveryAddressEditable", false);
                    this._oWizardModel.setProperty("/messageStripDeliveryAddressOnLineItemVisible", false);
                    this._oPRHeaderModel.setProperty("/deliveryAddress/deliveryAddressOnLineItems", false);
                } else {
                    this.byId("radioButtonGroupDeliveryOptions").setSelectedIndex(1);

                    this._oWizardModel.setProperty("/inputsDeliveryAddressEditable", true);
                    this._oWizardModel.setProperty("/messageStripDeliveryAddressOnLineItemVisible", false);
                    this._oPRHeaderModel.setProperty("/deliveryAddress/deliveryAddressOnLineItems", false);
                }
            },

            _compareDeliveryAddresses: function (oAddress1, oAddress2) {
                var aCheckResults = [];
                aCheckResults.push(oAddress1.Name1 === oAddress2.Name1);
                aCheckResults.push(oAddress1.Stras === oAddress2.Stras);
                aCheckResults.push(oAddress1.Hsnm1 === oAddress2.Hsnm1);
                aCheckResults.push(oAddress1.Ort01 === oAddress2.Ort01);
                aCheckResults.push(oAddress1.Pstlz === oAddress2.Pstlz);
                aCheckResults.push(oAddress1.Land1 === oAddress2.Land1);
                aCheckResults.push(oAddress1.Land1T === oAddress2.Land1T);
                aCheckResults.push(oAddress1.Region === oAddress2.Region);
                aCheckResults.push(oAddress1.RegionT === oAddress2.RegionT);

                return aCheckResults.filter((oElement) => { return oElement === false }).length === 0
            },

            _prepareVendorAndPOSendoutMailStepForEdit: function () {
                this.byId("inputVendorSearchNumber").setValue("");
                this.byId("inputVendorSearchName").setValue("");

                // Prepare vendor model for list
                var oVendorModel = {
                    results: [
                        this._oPRHeaderModel.getProperty("/vendor")
                    ]
                }
                this.getView().setModel(new JSONModel(oVendorModel), "vendorModel");

                // Select item in list
                var oSelectedItem = this.byId("listVendorSelectionWizard").getItems()[0];
                this.byId("listVendorSelectionWizard").setSelectedItem(oSelectedItem);

                // Set PO sendout options
                this.byId("inputVendorEmail").setEnabled(this._oPRHeaderModel.getProperty("/pOSendoutToVendor"));
                this.byId("inputVendorEmail").setRequired(this._oPRHeaderModel.getProperty("/pOSendoutToVendor"));
                this.byId("inputUserEmail").setEnabled(this._oPRHeaderModel.getProperty("/pOSendoutToRequestor"));
                this.byId("inputUserEmail").setRequired(this._oPRHeaderModel.getProperty("/pOSendoutToRequestor"));
                this.byId("inputRecipientEmail").setEnabled(this._oPRHeaderModel.getProperty("/pOSendoutToRecipient"));
                this.byId("inputRecipientEmail").setRequired(this._oPRHeaderModel.getProperty("/pOSendoutToRecipient"));

                this.byId("checkBoxVendorMailToVendor").setSelected(this._oPRHeaderModel.getProperty("/pOSendoutToVendor"));
                this.byId("checkBoxVendorMailToRequestor").setSelected(this._oPRHeaderModel.getProperty("/pOSendoutToRequestor"));
                this.byId("checkBoxVendorMailToRecipient").setSelected(this._oPRHeaderModel.getProperty("/pOSendoutToRecipient"));

                // Set PO sendout values
                this.byId("inputVendorEmail").setValue(this._oPRHeaderModel.getProperty("/vendor/MAdr"));
                this.byId("inputUserEmail").setValue(this._oPRHeaderModel.getProperty("/requestor/email"));
                this.byId("inputRecipientEmail").setValue(this._oPRHeaderModel.getProperty("/recipientMail"));
            },

            _prepareDeliveryDateAndDocumentTypeStepForEdit: function () {
                this.resetCustomInputState(this.getView().byId("datePickerWizardDeliverDateOneTimeDeliveryDate"));
                this.resetCustomInputState(this.getView().byId("datePickerWizardDeliverDateMultipleDeliveriesFromDate"));
                this.resetCustomInputState(this.getView().byId("datePickerWizardDeliverDateMultipleDeliveriesToDate"));


                this._oWizardModel.setProperty("/multipleDeliveriesSelected", this._oPRHeaderModel.getProperty("/deliveryDates/multipleDeliveries"));

                this.byId("checkBoxDocumentTypeStandard").setSelected(false);
                this.byId("checkBoxDocumentTypeFramework").setSelected(this._oPRHeaderModel.getProperty("/documentType") === Constants.DOCTYPE_FRAMEWORK);
                this.byId("checkBoxDocumentTypeBlanket").setSelected(this._oPRHeaderModel.getProperty("/documentType") === Constants.DOCTYPE_BLANKED);
            },
        });
    });
