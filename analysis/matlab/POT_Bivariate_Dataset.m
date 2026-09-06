clc
clear

%% =========================================================
% 1. ADD SFE-IFC TOOLBOX
% ==========================================================

addpath(genpath( ...
    'C:\Users\soura\SFE_IFC-Toolbox-main\SFE_IFC-Toolbox-main'));


%% =========================================================
% 2. READ DISCHARGE DATA
% ==========================================================

filename = 'Ukai(1975-2021).xlsx';

data = readmatrix(filename,'Sheet','62255');

flowdata = data;


%% =========================================================
% 3. CATCHMENT AREA
% ==========================================================

area_km = 62255;


%% =========================================================
% 4. INDEPENDENCE INTERVAL
%    SFE-IFC formula: floor(5 + log(A / 1.609^2))
%    For A = 62255 km^2 this equals 15 days
% ==========================================================

interval = floor(5 + log(area_km/1.609^2));

fprintf('Independence interval = %d days\n',interval);


%% =========================================================
% 5. AUTOMATIC POT THRESHOLD
% ==========================================================

[output_para,figuredata] = ...
    Auto_select_thre(flowdata,interval);

threshold = output_para(1);

fprintf('Selected POT threshold = %.4f m3/s\n',threshold);


%% =========================================================
% 6. EXTRACT INDEPENDENT POT EVENTS
% ==========================================================

peaks_datenum = ...
    selectpeaks(flowdata,threshold,interval);

fprintf('\nNumber of POT events = %d\n', ...
    size(peaks_datenum,1));


%% =========================================================
% 7. EXTRACT PEAK VALUES
% ==========================================================

POT_peak = peaks_datenum(:,2);


%% =========================================================
% 8. EXTRACT START AND END DATES
% ==========================================================

start_dates = datevec(peaks_datenum(:,4));

end_dates = datevec(peaks_datenum(:,6));

starendtime = [
    start_dates(:,1:3), ...
    end_dates(:,1:3)
];


%% =========================================================
% 9. CALCULATE EVENT DURATION
% ==========================================================

% Inclusive of both start and end dates

Duration = peaks_datenum(:,6) ...
         - peaks_datenum(:,4) + 1;


%% =========================================================
% 10. CALCULATE FLOOD VOLUME
% ==========================================================

Volume = zeros(length(POT_peak),1);

for i = 1:length(POT_peak)

    start_idx = find( ...
        flowdata(:,1) == starendtime(i,1) & ...
        flowdata(:,2) == starendtime(i,2) & ...
        flowdata(:,3) == starendtime(i,3), ...
        1);

    end_idx = find( ...
        flowdata(:,1) == starendtime(i,4) & ...
        flowdata(:,2) == starendtime(i,5) & ...
        flowdata(:,3) == starendtime(i,6), ...
        1);

    % Extract discharge during flood event

    Q_event = flowdata(start_idx:end_idx,4);

    % Daily discharge to volume
    % 1 day = 86400 seconds

    Volume(i) = sum(Q_event) * 86400;

end


%% =========================================================
% 11. CREATE FINAL POT P-V-D DATASET
% ==========================================================

POT_PVD = table( ...
    POT_peak, ...
    Volume, ...
    Duration, ...
    'VariableNames', ...
    {'Peakvalue_m3_s','Volume_m3','Duration_days'});


%% =========================================================
% 12. DISPLAY DATASET
% ==========================================================

disp('============================================')
disp('FINAL POT P-V-D DATASET')
disp('============================================')

disp(POT_PVD)


%% =========================================================
% 13. SAVE DATASET
% ==========================================================

writetable( ...
    POT_PVD, ...
    'C:\RapidsProjects\Btp\data\processed\POT_PVD_final_dataset.xlsx');

fprintf('\nPOT P-V-D dataset saved successfully.\n');
fprintf('Path: C:\\RapidsProjects\\Btp\\data\\processed\\POT_PVD_final_dataset.xlsx\n');