sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], (Controller, JSONModel, MessageToast) => {
    "use strict";

    return Controller.extend("com.triumph.putawaybymarriage.controller.Main", {

        /* =========================================================== */
        /* Just For Dev- Mock Server using Json                        */
        /* =========================================================== */
        readTest: function () {
            var oModel = this.getOwnerComponent().getModel();
            oModel.read("/BatchMaterialSet", {
                method: "GET",
                success: (oData) => {
                    console.log(oData);
                },
                error: (oError) => {
                    MessageBox.error("Error : " + oError.responseText, {
                        emphasizedAction: MessageBox.Action.CLOSE
                    });
                    console.error("Error during readTest.");
                }
            });
        },
        createTest: function () {
            var oPayload = {
                "ID": 5,
                "Name": "Product E",
                "Price": 500
            };

            var oModel = this.getOwnerComponent().getModel();
            oModel.create("/Products", oPayload, {
                method: "POST",
                success: (oData) => {
                    console.log(oData);
                },
                error: (oError) => {
                    MessageBox.error("Error : " + oError.responseText, {
                        emphasizedAction: MessageBox.Action.CLOSE
                    });
                    console.error("Error during createTest.");
                },
            });
        },
        /* =========================================================== */

        onInit: function () {


            const today = new Date();

            // Min: first day of last month
            const minDate = new Date(
                today.getFullYear(),
                today.getMonth() - 1,
                1
            );

            // Max: last day of current month
            const maxDate = new Date(
                today.getFullYear(),
                today.getMonth() + 1,
                0
            );
            const postingDate = new Date();

            const oDateModel = new sap.ui.model.json.JSONModel({
                postingDate,
                minDate,
                maxDate
            });

            this.getView().setModel(oDateModel, "dateModel");








            this._oAppModel = this.getOwnerComponent().getModel("appModel");




            const aRows = [];

            // Create exactly 20 empty rows
            for (let i = 0; i < 20; i++) {
                aRows.push({ batch: "", inputBatch: "", sourceStorageBin: "", sourceStorageType: "", batchState: "None", batchStateText: "", binState: "None", binStateText: "" });
            }

            const initialData = {
                rows: aRows,
                canContinue: false,
                state: true,
                sameDBin: false
            };

            this._oAppModel.setData(initialData);

            // Initial focus on first Batch cell
            setTimeout(() => {
                this._focusCell(0, 0);
            }, 0);

            this._updateContinueState();
            this._validateRows();


        },

        onScanningModeChange: function () {
            const aCurrenteMode = this._oAppModel.getProperty("/state"); //false mean single batch scanning
            if (aCurrenteMode === false) {
                const aRows = [];

                // Create exactly 1 empty rows
                for (let i = 0; i < 1; i++) {
                    aRows.push({ batch: "", inputBatch: "", sourceStorageBin: "", sourceStorageType: "", batchState: "None", batchStateText: "", binState: "None", binStateText: "" });
                }

                this._oAppModel.setProperty("/rows", aRows);

                // Initial focus on first Batch cell
                setTimeout(() => {
                    this._focusCell(0, 0);
                }, 0);
            } else {
                const aRows = [];

                // Create exactly 20 empty rows
                for (let i = 0; i < 20; i++) {
                    aRows.push({ batch: "", inputBatch: "", sourceStorageBin: "", sourceStorageType: "", batchState: "None", batchStateText: "", binState: "None", binStateText: "" });
                }
                this._oAppModel.setProperty("/rows", aRows);

                // Initial focus on first Batch cell
                setTimeout(() => {
                    this._focusCell(0, 0);
                }, 0);
            }

        },


        onScanSubmit: function (oEvent) {
            const oInput = oEvent.getSource();
            const sCol = oInput.data("col");
            const oCtx = oInput.getBindingContext("appModel");

            const oItem = oInput.getParent(); // ColumnListItem
            const oTable = this.byId("scanTable");
            const iRowIndex = oTable.indexOfItem(oItem);

            if (sCol === "BIN") {
                const sBatch = oCtx.getProperty("batch");
                if (!sBatch) {
                    oInput.setValue("");
                    oInput.setValueState("Error");
                    oInput.setValueStateText("Scan Batch first");
                    return;
                }
                else {
                    this._validateBin(oInput, iRowIndex);
                }
            }



            if (sCol === "BATCH") {
                this._validateBatch(oInput, iRowIndex);
                return; // ⛔ stop normal flow until validation passes
            }
            this._moveFocus(iRowIndex, sCol);
            this._updateContinueState();
            this._validateRows();


        },
        _validateBatch: function (oInput, iRowIndex) {
            const aRows = this._oAppModel.getProperty("/rows");
            const sBatch = oInput.getValue();

            // ---------- STEP 1: Local duplicate check ----------
            const bDuplicate = aRows.some((r, idx) =>
                idx !== iRowIndex && r.inputBatch === sBatch
            );

            if (bDuplicate) {
                this._rejectBatch(oInput, iRowIndex, "Batch already scanned");
                return;
            }

            // ---------- STEP 2: Backend validation ----------
            // Commented for development

            this._checkBatchWithBackend(sBatch)
                .then((sMaterial) => {
                    // ✅ SUCCESS → normal flow
                    this._selectBatch(oInput, iRowIndex, sBatch, sMaterial);
                    this._moveFocus(iRowIndex, "BATCH");
                    this._validateRows();
                    this._updateContinueState();
                })
                .catch(() => {
                    // ❌ FAIL
                    this._rejectBatch(oInput, iRowIndex, "Invalid Batch");
                });


            // ---------- DEV MODE: continue normal flow ----------
            // this._moveFocus(iRowIndex, "BATCH");
            // this._validateRows();
            // this._updateContinueState();
        },

        _validateBin: function (oInput, iRowIndex) {
            const aRows = this._oAppModel.getProperty("/rows");
            const sBin = oInput.getValue();


            // ---------- STEP 2: Backend validation ----------
            // Commented for development

            this._checkBinWithBackend(sBin)
                .then((sStorageTyp) => {
                    // ✅ SUCCESS → normal flow

                    // add model value
                    this._oAppModel.setProperty(`/rows/${iRowIndex}/sourceStorageType`, sStorageTyp);
                    // this._selectBatch(oInput, iRowIndex, sBatch, sMaterial);
                    this._moveFocus(iRowIndex, "BIN");
                    this._validateRows();
                    this._updateContinueState();
                })
                .catch(() => {
                    // ❌ FAIL
                    this._rejectBin(oInput, iRowIndex, "Invalid Bin");
                });


        },

        _rejectBatch: function (oInput, iRowIndex, sMessage) {
            // Clear model value
            this._oAppModel.setProperty(`/rows/${iRowIndex}/batch`, "");

            // Clear input + error
            oInput.setValue("");
            oInput.setValueState("Error");
            oInput.setValueStateText(sMessage);

            // Keep focus on same Batch cell
            setTimeout(() => {
                this._focusCell(iRowIndex, 0);
            }, 0);
        },
        _rejectBin: function (oInput, iRowIndex, sMessage) {
            // Clear model value
            this._oAppModel.setProperty(`/rows/${iRowIndex}/sourceStorageBin`, "");

            // Clear input + error
            oInput.setValue("");
            oInput.setValueState("Error");
            oInput.setValueStateText(sMessage);

            // Keep focus on same Batch cell
            setTimeout(() => {
                this._focusCell(iRowIndex, 0);
            }, 0);
        },
        _selectBatch: function (oInput, iRowIndex, sBatch, sMaterial) {
            // add model value
            this._oAppModel.setProperty(`/rows/${iRowIndex}/batch`, sMaterial);
            this._oAppModel.setProperty(`/rows/${iRowIndex}/inputBatch`, sBatch);

            // Clear input + error
            oInput.setValue(sMaterial);
            oInput.setValueState("None");
            oInput.setValueStateText("");

        },
        _checkBatchWithBackend: function (sBatch) {
            return new Promise((resolve, reject) => {
                const oModel = this.getView().getModel(); // OData model

                oModel.read("/BatchMaterialSet", {
                    filters: [
                        new sap.ui.model.Filter("Charg", "EQ", sBatch)
                    ],
                    success: function (oData) {
                        if (oData.results && oData.results.length) {
                            resolve(oData.results[0].Matnr);
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


        _moveFocus: function (iRowIndex, sColumn) {
            const oTable = this.byId("scanTable");
            const iLastRow = oTable.getItems().length - 1;

            let iNextRow, iNextCol;

            // -------- BATCH COLUMN --------
            if (sColumn === "BATCH") {

                // C1R1 -> C1R2 -> ... -> C1R20
                if (iRowIndex < iLastRow) {
                    iNextRow = iRowIndex + 1;
                    iNextCol = 0; // Batch
                }
                // C1R20 -> C2R1
                else {
                    iNextRow = 0;
                    iNextCol = 1; // Bin
                }

            }
            // -------- BIN COLUMN --------
            else {

                // C2R1 -> C2R2 -> ... -> C2R20
                if (iRowIndex < iLastRow) {
                    iNextRow = iRowIndex + 1;
                    iNextCol = 1; // Bin
                }
                // C2R20 -> Submit button
                else {
                    this.byId("continueButton").focus();
                    return;
                }

            }

            setTimeout(() => {
                this._focusCell(iNextRow, iNextCol);
            }, 0);
        },


        _focusCell: function (iRow, iCol) {
            const oTable = this.byId("scanTable");
            const oItems = oTable.getItems();

            if (oItems[iRow]) {
                const oCell = oItems[iRow].getCells()[iCol];
                if (oCell && oCell.focus) {
                    oCell.focus();
                }
            }
        },

        onContinue: function () {
            this._validateRows(); // ensure latest manual changes are validated

            const aRows = this._oAppModel.getProperty("/rows");

            // ✅ Keep only rows having both Batch and Bin
            const aValidRows = aRows.filter(r => r.batch && r.sourceStorageBin);

            if (!aValidRows.length) {
                MessageToast.show("No valid data scanned");
                return;
            }

            const oScannerModel = this.getOwnerComponent().getModel("scannerModel");

            oScannerModel.setData({
                items: aValidRows.map(r => ({
                    batch: r.batch,
                    inputBatch: r.inputBatch,
                    sourceBin: r.sourceStorageBin,
                    destinationStorageBin: "",
                    destinationStorageType: "",
                    destinationBinConfirm: "",
                    confirmed: false
                })),
                currentIndex: 0,
                totalCount: aValidRows.length
            });

            // Use aValidRows for backend / navigation
            console.log(aValidRows);
            MessageToast.show("Proceeding with " + aValidRows.length + " rows");

            //Puting all the valid rows for final
            // this.getOwnerComponent().getModel("scannerModel").setProperty("/scannedBatchBin", aValidRows);
            console.log(this.getOwnerComponent().getModel("scannerModel"));

            // Example:
            // this._submitPutaway(aValidRows);
            // this.getOwnerComponent().getRouter().navTo("NextPage", { data: aValidRows });
            this.getOwnerComponent().getRouter().navTo("DestinationBin");
        },

        //onSameDBin
        onSameDBin: function () {
            this._validateRows(); // ensure latest manual changes are validated

            const aRows = this._oAppModel.getProperty("/rows");

            // ✅ Keep only rows having both Batch and Bin
            const aValidRows = aRows.filter(r => r.batch && r.sourceStorageBin);

            if (!aValidRows.length) {
                MessageToast.show("No valid data scanned");
                return;
            }

            const oScannerModel = this.getOwnerComponent().getModel("scannerModel");

            oScannerModel.setData({
                items: aValidRows.map(r => ({
                    batch: r.batch,
                    inputBatch: r.inputBatch,
                    sourceBin: r.sourceStorageBin,
                    destinationStorageBin: "",
                    destinationStorageType: "",
                    destinationBinConfirm: "",
                    confirmed: false
                })),
                currentIndex: aValidRows.length - 1,
                totalCount: aValidRows.length
            });

            // Use aValidRows for backend / navigation
            console.log(aValidRows);
            MessageToast.show("Proceeding with " + aValidRows.length + " rows");

            this._oAppModel.setProperty("/sameDBin", true);
            //Puting all the valid rows for final
            // this.getOwnerComponent().getModel("scannerModel").setProperty("/scannedBatchBin", aValidRows);
            console.log(this.getOwnerComponent().getModel("scannerModel"));

            // Example:
            // this._submitPutaway(aValidRows);
            // this.getOwnerComponent().getRouter().navTo("NextPage", { data: aValidRows });
            this.getOwnerComponent().getRouter().navTo("DestinationBin");
        },

        _updateContinueState: function () {
            const aRows = this._oAppModel.getProperty("/rows");

            // Only rows that are partially filled (Batch or Bin) must have both values
            const bCanContinue = aRows.every(row => {
                const hasBatch = !!row.batch;
                const hasBin = !!row.sourceStorageBin;

                // Completely empty rows are ignored
                if (!hasBatch && !hasBin) return true;

                // Row is valid only if BOTH Batch and Bin are filled
                return hasBatch && hasBin;
            });

            this._oAppModel.setProperty("/canContinue", bCanContinue);
        },

        _validateRows: function () {
            const aRows = this._oAppModel.getProperty("/rows");

            let bAllValid = true;
            const batchSet = new Set();

            aRows.forEach(row => {
                const bHasBatch = !!row.batch;
                const bHasBin = !!row.sourceStorageBin;

                // Reset states
                row.batchState = "None";
                row.batchStateText = "";
                row.binState = "None";
                row.binStateText = "";

                // ---------- Duplicate Batch Check ----------
                if (bHasBatch) {
                    if (batchSet.has(row.batch)) {
                        row.batchState = "Error";
                        row.batchStateText = "Duplicate Batch!";
                        bAllValid = false;
                    } else {
                        batchSet.add(row.batch);
                    }
                }

                // ---------- Bin Required Check ----------
                if (bHasBatch && !bHasBin) {
                    // row.binState = "Error";
                    row.binStateText = "Bin required for filled Batch";
                    bAllValid = false;
                }
            });

            this._oAppModel.setProperty("/rows", aRows); // refresh bindings
            this._oAppModel.setProperty("/canContinue", bAllValid && aRows.some(r => r.batch && r.sourceStorageBin));
        },
        onCopySourceBin: function () {
            const aRows = this._oAppModel.getProperty("/rows");

            if (!aRows.length) return;

            // Source sourceStorageBin = first row's Bin
            const sSourceStorageBin = aRows[0].sourceStorageBin;
            const sSourceStorageType = aRows[0].sourceStorageType;

            if (!sSourceStorageBin) {
                sap.m.MessageToast.show("Source Bin (Row 1) is empty!");
                return;
            }

            // Copy Source Bin to all rows which have Batch filled
            aRows.forEach(row => {
                if (row.batch) {
                    row.sourceStorageBin = sSourceStorageBin;
                    row.sourceStorageType = sSourceStorageType;
                    row.binState = "None";
                    row.binStateText = "";
                }
            });

            this._oAppModel.setProperty("/rows", aRows);

            // Re-validate rows and update Continue button state
            this._validateRows();

            sap.m.MessageToast.show("Source Bin copied to all filled rows.");
        },
        onBatchChange: function (oEvent) {
            const oInput = oEvent.getSource();
            const oCtx = oInput.getBindingContext("appModel");
            const iRowIndex = this.byId("scanTable").indexOfItem(oInput.getParent());

            // Run the same duplicate check & re-validate rows
            this._validateBatch(oInput, iRowIndex);
        },


        //onClear
        onClear: function () {
            this.onInit();
        },


        //New Additions for wizard page
        onWizardPage: function () {
            this.getOwnerComponent().getRouter().navTo("HeaderWizard", { subPr: 0 });

        },


        _testLogData: function () {
            console.log("calledtestLogData");
            const oModel = this.getView().getModel(); // OData model

            oModel.read("/ActivityAreaSet", {
                success: function (oData) {

                    console.log("No chnage data");
                    console.log(oData);
                    const filter =
                    {
                        "PUTAWAY": true,
                        "REPLENISH": false,
                        "TRANSFER": true,
                        "RETREPQUA": true,
                    };
                    //Changes by EX_KONDARU01 for CR CHG0615427
                    if (!Object.values(filter).every(value => value === true) || Object.values(filter).every(value => value === false)) {
                        console.log("No chnage oData.results");
                        console.log(oData.results);

                        oData.results = oData.results.map((activityArea) => {
                            const counts = [
                                ...activityArea.toProcess.results,
                                {
                                    "boxesOnConveyor": 0,
                                    "piecesOnConveyor": 0,
                                    "boxesDischarged": 0,
                                    "piecesDischarged": 0,
                                    "boxesInSection": 0,
                                    "piecesInSection": 0,
                                }
                            ]
                                .filter(process => !process.process || filter[process.process])
                                .reduce((acc, process) => {
                                    Object.keys(process).forEach(key => {
                                        if (typeof process[key] === 'number') {
                                            acc[key] = (acc[key] || 0) + process[key];
                                        }
                                    });
                                    return acc;
                                }, {});
                            return {
                                ...activityArea,
                                ...counts
                            };
                        });
                    }
                    //End of changes
                    // this.getOwnerComponent().getModel("activityAreaModel").setData(oData);
                    console.log("oDataAfterChangesis");
                    console.log(oData);



                },
                error: function (oError) {
                    console.log(oError);

                }
            });
        }


    });
});