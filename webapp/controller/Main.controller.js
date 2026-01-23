sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], (Controller, JSONModel, MessageToast) => {
    "use strict";

    return Controller.extend("com.triumph.putawaybymarriage.controller.Main", {

        onInit: function () {
            const aRows = [];

            // Create exactly 20 empty rows
            for (let i = 0; i < 20; i++) {
                aRows.push({ batch: "", bin: "", batchState: "None", batchStateText: "", binState: "None", binStateText: "" });
            }

            const oModel = new JSONModel({
                rows: aRows,
                canContinue: false
            });

            this.getView().setModel(oModel, "appModel");

            // Initial focus on first Batch cell
            setTimeout(() => {
                this._focusCell(0, 0);
            }, 0);

            this._updateContinueState();
            this._validateRows();


        },


        onScanSubmit: function (oEvent) {
            const oInput = oEvent.getSource();
            const sCol = oInput.data("col");
            const oCtx = oInput.getBindingContext("appModel");

            if (sCol === "BIN") {
                const sBatch = oCtx.getProperty("batch");
                if (!sBatch) {
                    oInput.setValue("");
                    oInput.setValueState("Error");
                    oInput.setValueStateText("Scan Batch first");
                    return;
                }
            }


            const oItem = oInput.getParent(); // ColumnListItem
            const oTable = this.byId("scanTable");
            const iRowIndex = oTable.indexOfItem(oItem);
            if (sCol === "BATCH") {
                this._validateBatch(oInput, iRowIndex);
                return; // ⛔ stop normal flow until validation passes
            }
            this._moveFocus(iRowIndex, sCol);
            this._updateContinueState();
            this._validateRows();


        },
        _validateBatch: function (oInput, iRowIndex) {
            const oModel = this.getView().getModel("appModel");
            const aRows = oModel.getProperty("/rows");
            const sBatch = oInput.getValue();

            // ---------- STEP 1: Local duplicate check ----------
            const bDuplicate = aRows.some((r, idx) =>
                idx !== iRowIndex && r.batch === sBatch
            );

            if (bDuplicate) {
                this._rejectBatch(oInput, iRowIndex, "Batch already scanned");
                return;
            }

            // ---------- STEP 2: Backend validation ----------
            // Commented for development
            /*
            this._checkBatchWithBackend(sBatch)
                .then(() => {
                    // ✅ SUCCESS → normal flow
                    this._moveFocus(iRowIndex, "BATCH");
                    this._validateRows();
                    this._updateContinueState();
                })
                .catch(() => {
                    // ❌ FAIL
                    this._rejectBatch(oInput, iRowIndex, "Invalid Batch");
                });
            */

            // ---------- DEV MODE: continue normal flow ----------
            this._moveFocus(iRowIndex, "BATCH");
            this._validateRows();
            this._updateContinueState();
        },

        _rejectBatch: function (oInput, iRowIndex, sMessage) {
            const oModel = this.getView().getModel("appModel");

            // Clear model value
            oModel.setProperty(`/rows/${iRowIndex}/batch`, "");

            // Clear input + error
            oInput.setValue("");
            oInput.setValueState("Error");
            oInput.setValueStateText(sMessage);

            // Keep focus on same Batch cell
            setTimeout(() => {
                this._focusCell(iRowIndex, 0);
            }, 0);
        },
        _checkBatchWithBackend: function (sBatch) {
            return new Promise((resolve, reject) => {
                const oModel = this.getView().getModel(); // OData model

                oModel.read("/BatchSet", {
                    filters: [
                        new sap.ui.model.Filter("Batch", "EQ", sBatch)
                    ],
                    success: function (oData) {
                        if (oData.results && oData.results.length) {
                            resolve();
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

            const oModel = this.getView().getModel("appModel");
            const aRows = oModel.getProperty("/rows");

            // ✅ Keep only rows having both Batch and Bin
            const aValidRows = aRows.filter(r => r.batch && r.bin);

            if (!aValidRows.length) {
                MessageToast.show("No valid data scanned");
                return;
            }

            // Use aValidRows for backend / navigation
            console.log(aValidRows);
            MessageToast.show("Proceeding with " + aValidRows.length + " rows");

            //Puting all the valid rows for final
            this.getOwnerComponent().getModel("scannerModel").setProperty("/scannedBatchBin", aValidRows);
            console.log(this.getOwnerComponent().getModel("scannerModel"));

            // Example:
            // this._submitPutaway(aValidRows);
            // this.getOwnerComponent().getRouter().navTo("NextPage", { data: aValidRows });
            this.getOwnerComponent().getRouter().navTo("DestinationBin");
        },

        _updateContinueState: function () {
            const oModel = this.getView().getModel("appModel");
            const aRows = oModel.getProperty("/rows");

            // Only rows that are partially filled (Batch or Bin) must have both values
            const bCanContinue = aRows.every(row => {
                const hasBatch = !!row.batch;
                const hasBin = !!row.bin;

                // Completely empty rows are ignored
                if (!hasBatch && !hasBin) return true;

                // Row is valid only if BOTH Batch and Bin are filled
                return hasBatch && hasBin;
            });

            oModel.setProperty("/canContinue", bCanContinue);
        },

        _validateRows: function () {
            const oModel = this.getView().getModel("appModel");
            const aRows = oModel.getProperty("/rows");

            let bAllValid = true;
            const batchSet = new Set();

            aRows.forEach(row => {
                const bHasBatch = !!row.batch;
                const bHasBin = !!row.bin;

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

            oModel.setProperty("/rows", aRows); // refresh bindings
            oModel.setProperty("/canContinue", bAllValid && aRows.some(r => r.batch && r.bin));
        },
        onCopySourceBin: function () {
            const oModel = this.getView().getModel("appModel");
            const aRows = oModel.getProperty("/rows");

            if (!aRows.length) return;

            // Source bin = first row's Bin
            const sSourceBin = aRows[0].bin;

            if (!sSourceBin) {
                sap.m.MessageToast.show("Source Bin (Row 1) is empty!");
                return;
            }

            // Copy Source Bin to all rows which have Batch filled
            aRows.forEach(row => {
                if (row.batch) {
                    row.bin = sSourceBin;
                    row.binState = "None";
                    row.binStateText = "";
                }
            });

            oModel.setProperty("/rows", aRows);

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



        //New Additions for wizard page
        onWizardPage: function () {
            this.getOwnerComponent().getRouter().navTo("HeaderWizard", { subPr: 0 });

        },



    });
});